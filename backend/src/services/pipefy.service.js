const axios = require('axios');

const PIPEFY_API_URL = 'https://api.pipefy.com/graphql';

class PipefyService {
  /**
   * Test Pipefy connection
   */
  async testConnection(token) {
    try {
      const query = `
        query {
          me {
            id
            name
            email
          }
        }
      `;

      const response = await this.makeRequest(query, {}, token);
      return {
        success: true,
        user: response.data.me
      };
    } catch (error) {
      throw new Error(`Pipefy connection failed: ${error.message}`);
    }
  }

  /**
   * Get pipe cards with filters and pagination
   */
  async getPipeCards(pipeId, token) {
    let allCards = [];
    let hasPreviousPage = true;
    let cursor = null;
    let pipeInfo = null;
    let pagesFetched = 0;
    const MAX_PAGES = 200; // 10000 cards max

    while (hasPreviousPage && pagesFetched < MAX_PAGES) {
      // NOTE: Using 'search' argument in allCards if looking for specific titles
      // Verify if API supports 'search: { title: "..." }' or similar if needed.
      // Standard Pipefy API 'allCards' doesn't support deep field filtering easily,
      // but let's assume standard pagination for now.
      const query = `
        query($pipeId: ID!, $cursor: String) {
          pipe(id: $pipeId) {
            id
            name
            phases {
              id
              name
              cards_count
            }
            labels {
              id
              name
              color
            }
          }
          allCards(pipeId: $pipeId, last: 50, before: $cursor) {
            edges {
              node {
                id
                title
                current_phase {
                  id
                  name
                }
                labels {
                  name
                }
                created_at
                updated_at
                finished_at
                fields {
                  name
                  value
                }
              }
            }
            pageInfo {
              hasPreviousPage
              startCursor
            }
          }
        }
      `;

      const response = await this.makeRequest(query, { pipeId, cursor }, token);

      if (!pipeInfo) pipeInfo = response.data.pipe;

      const pageCards = response.data.allCards.edges.map(edge => edge.node);

      allCards = allCards.concat(pageCards);

      hasPreviousPage = response.data.allCards.pageInfo.hasPreviousPage;
      cursor = response.data.allCards.pageInfo.startCursor;
      pagesFetched++;
    }

    return {
      pipe: pipeInfo,
      cards: allCards
    };
  }

  /**
   * Get pipe metrics for a date range, grouped by labels and dates
   */
  async getPipeMetrics(pipeId, token, startDate, endDate) {
    const pipeData = await this.getPipeCards(pipeId, token);
    const cards = pipeData.cards;
    const pipeLabels = pipeData.pipe.labels.map(l => l.name);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Tags to track (curated list + anything found in pipe)
    const trackedTags = ['META ADS', 'ORGÂNICO', 'GPTMAKER', 'GOOGLE ADS', ...pipeLabels.map(l => l.toUpperCase())];
    const uniqueTags = [...new Set(trackedTags)];

    const getCardTags = (card) => {
      const tags = new Set();

      // Check labels
      if (card.labels) {
        card.labels.forEach(l => {
          const name = l.name.toUpperCase();
          uniqueTags.forEach(t => {
            if (name.includes(t)) tags.add(t);
          });
        });
      }

      // Check fields
      const originField = card.fields?.find(f =>
        f.name === 'Etiqueta origem do lead' ||
        f.name === 'Origem do Lead' ||
        f.name === 'Origem do Lead(Nome)'
      );
      if (originField && originField.value) {
        const val = originField.value.toUpperCase();
        uniqueTags.forEach(t => {
          if (val.includes(t)) tags.add(t);
        });
      }

      return Array.from(tags);
    };

    // Initialize daily metrics structure
    // Key: YYYY-MM-DD, Value: { tag: { metrics... } }
    const dailyMetrics = {};

    const initMetricsObj = () => ({
      cardsCreated: 0,
      cardsQualified: 0,
      cardsConverted: 0,
      cardsLost: 0,
      cardsByPhase: {}
    });

    const getDayMetrics = (dateStr, tag) => {
      if (!dailyMetrics[dateStr]) dailyMetrics[dateStr] = {};
      if (!dailyMetrics[dateStr][tag]) dailyMetrics[dateStr][tag] = initMetricsObj();
      return dailyMetrics[dateStr][tag];
    };

    // Also track aggregate for legacy compatibility (though sync service should use daily)
    const metricsByTag = {};
    const allTagsList = ['all', ...uniqueTags];
    allTagsList.forEach(t => metricsByTag[t] = initMetricsObj());

    // Snapshot phases for 'all'
    if (pipeData.pipe && pipeData.pipe.phases) {
      pipeData.pipe.phases.forEach(phase => {
        metricsByTag['all'].cardsByPhase[phase.name] = phase.cards_count;
      });
    }

    // Process all cards
    cards.forEach(card => {
      const createdAt = new Date(card.created_at);
      const updatedAt = new Date(card.updated_at);
      const finishedAt = card.finished_at ? new Date(card.finished_at) : updatedAt;

      const createdDateStr = createdAt.toISOString().split('T')[0];
      const updatedDateStr = updatedAt.toISOString().split('T')[0];

      // CUSTOM DATE LOGIC (Andar Seguros & others using this standard)
      // If "Data de fechamento da Apólice" exists, use it as the sale date.
      const customDateFields = ['Data de fechamento da Apólice', 'Data Venda', 'Data de Fechamento'];
      const closingField = card.fields?.find(f => customDateFields.includes(f.name) && f.value);

      if (closingField) {
        // Pipefy dates are usually YYYY-MM-DD or DD/MM/YYYY. Let's try to parse.
        // If YYYY-MM-DD (ISO)
        if (closingField.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Treat as UTC or fix timezone? usually strictly date.
          // Set finishedAt to this date (at noon or end of day to be safe?)
          // Actually we just need the string YYYY-MM-DD.
          const parts = closingField.value.split('-');
          finishedAt.setFullYear(parts[0], parts[1] - 1, parts[2]);
        } else if (closingField.value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // DD/MM/YYYY
          const parts = closingField.value.split('/');
          finishedAt.setFullYear(parts[2], parts[1] - 1, parts[0]);
        }
      }

      const finishedDateStr = finishedAt.toISOString().split('T')[0];

      const isCreatedInPeriod = createdAt >= start && createdAt <= end;
      // For updates/finish, we check if the DATE matches, regardless of range passed for strict counting,
      // but here we filter to requested range to check if valid.
      // However, we want to bucket by actual date.

      const cardTags = getCardTags(card);
      const allAndTags = ['all', ...cardTags];

      // 1. Leads Created
      if (isCreatedInPeriod) {
        allAndTags.forEach(t => {
          metricsByTag[t].cardsCreated++;
          getDayMetrics(createdDateStr, t).cardsCreated++;
        });
      }

      // 2. Leads Qualified
      const isQual = card.current_phase && card.current_phase.name.toLowerCase().includes('qualifica');
      if (isQual && updatedAt >= start && updatedAt <= end) {
        allAndTags.forEach(t => {
          metricsByTag[t].cardsQualified++;
          getDayMetrics(updatedDateStr, t).cardsQualified++;
        });
      }

      // 3. Sales Won
      const isWon = card.current_phase && card.current_phase.name.toLowerCase().includes('ganho');
      if (isWon && finishedAt >= start && finishedAt <= end) {
        allAndTags.forEach(t => {
          metricsByTag[t].cardsConverted++;
          getDayMetrics(finishedDateStr, t).cardsConverted++;
        });
      }

      // 4. Leads Lost
      const isLost = card.current_phase && card.current_phase.name.toLowerCase().includes('perdido');
      if (isLost && finishedAt >= start && finishedAt <= end) {
        allAndTags.forEach(t => {
          metricsByTag[t].cardsLost++;
          getDayMetrics(finishedDateStr, t).cardsLost++;
        });
      }

      // 5. Snapshot Phases (Only for aggregate, or daily? Daily snapshot doesn't make sense, use aggregate)
      if (card.current_phase) {
        const phaseName = card.current_phase.name;
        cardTags.forEach(t => {
          metricsByTag[t].cardsByPhase[phaseName] = (metricsByTag[t].cardsByPhase[phaseName] || 0) + 1;
        });
      }
    });

    // Final calculations
    [dailyMetrics, { root: metricsByTag }].forEach(scope => {
      // Handle nested structure
      const target = scope.root || scope;
      Object.keys(target).forEach(key => {
        // If it's a date key (YYYY-MM-DD) or tag key (ROOT)
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) { // Date key
          const dayTags = target[key];
          Object.keys(dayTags).forEach(t => {
            const m = dayTags[t];
            m.conversionRate = m.cardsCreated > 0 ? (m.cardsConverted / m.cardsCreated) * 100 : 0;
          });
        } else if (target[key].cardsCreated !== undefined) { // Tag key in root
          const m = target[key];
          m.conversionRate = m.cardsCreated > 0 ? (m.cardsConverted / m.cardsCreated) * 100 : 0;
        }
      });
    });


    return {
      metricsByTag, // Backward compatibility for now (or removal)
      dailyMetrics, // NEW: grouped by day
      availableTags: uniqueTags,
      pipeLabels: pipeData.pipe.labels
    };
  }

  /**
   * Make GraphQL request to Pipefy
   */
  async makeRequest(query, variables, token) {
    try {
      const response = await axios.post(
        PIPEFY_API_URL,
        { query, variables },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Pipefy API Error: ${error.response.data.errors?.[0]?.message || error.message}`);
      }
      throw error;
    }
  }
}

module.exports = new PipefyService();
