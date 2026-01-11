
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
// dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PIPEFY_TOKEN = '4539655447781a798935c1050882e99f471e4e6d47b5204480ce79564cb310ff'; // Hardcoded for immediate debug
const PIPEFY_PIPE_ID = '306438109'; // Updated from user URL

if (!PIPEFY_TOKEN) {
  console.error("ERROR: No PIPEFY_TOKEN found in .env");
  process.exit(1);
}

const endpoint = 'https://api.pipefy.com/graphql';

const client = new GraphQLClient(endpoint, {
  headers: {
    authorization: `Bearer ${PIPEFY_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

const query = gql`
  query($after: String) {
    allCards(pipeId: ${PIPEFY_PIPE_ID}, first: 50, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          createdAt
          finished_at
          updated_at
          current_phase {
            id
            name
          }
        }
      }
    }
  }
`;

function isDec(date) {
  if (!date) return false;
  return date.getFullYear() === 2025 && date.getMonth() === 11; // Dec 2025
}

async function fetchAllCards() {
  let allCards = [];
  let hasNextPage = true;
  let after = null;

  console.log('Fetching all cards to calculate December stats...');

  while (hasNextPage) {
    try {
      const data = await client.request(query, { after });
      const { edges, pageInfo } = data.allCards;

      allCards.push(...edges.map(e => e.node));

      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;
    } catch (error) {
      console.error('Error fetching:', error);
      break;
    }
  }

  console.log(`\nTotal Fetched: ${allCards.length}`);
  calculateDecemberStats(allCards);
}

function calculateDecemberStats(cards) {
  let countCreated = 0;

  // "Enters" (New + Backlog Qualified)
  let potentialBacklog = 0;

  // "Lost" (New Lost + Backlog Lost)
  let lostNew = 0;
  let lostBacklog = 0;
  let lostDetails = [];

  // "Won" (New Won + Backlog Won)
  let wonNew = 0;
  let wonBacklog = 0;

  cards.forEach(card => {
    const created = new Date(card.createdAt);
    const finished = card.finished_at ? new Date(card.finished_at) : null;
    const updated = new Date(card.updated_at);
    const status = card.current_phase.name;
    const phaseId = card.current_phase.id;

    // 1. Created in Dec
    if (isDec(created)) {
      countCreated++;

      if (status === 'Fechamento - Perdido') {
        lostNew++;
        lostDetails.push({ type: 'NEW', title: card.title, id: card.id, phaseId, created, finished, updated });
      }
      if (status === 'Fechamento - Ganho') wonNew++;
      // NOTE: Does NOT count towards 'Entraram' if created in Dec, it's already counted in 'countCreated'

    } else {
      // BACKLOG (Created before Dec)

      // Potential Logic: If currently in "Potencial" and updated in Dec
      if (status === 'Potencial Cliente Futuro' && isDec(updated)) {
        potentialBacklog++;
      }

      // Lost Logic: If finished or updated in Dec
      if (status === 'Fechamento - Perdido') {
        const effectiveDate = finished || updated;
        if (isDec(effectiveDate)) {
          lostBacklog++;
          lostDetails.push({ type: 'BACKLOG', title: card.title, id: card.id, phaseId, created, finished, updated });
        }
      }

      // Won Logic
      if (status === 'Fechamento - Ganho') {
        // STRICT WON LOGIC CHECK (Finished VS Updated)
        if (finished && isDec(finished)) {
          wonBacklog++;
        }
      }
    }
  });

  console.log(`\n--- ANALYZING DECEMBER 2025 ---`);
  console.log(`1. LEADS ENTRARAM (Target: 114)`);
  console.log(`   - Strictly Created in Dec: ${countCreated}`);
  console.log(`   - Backlog 'Potencial' Updated in Dec: ${potentialBacklog}`);
  console.log(`   - SUM: ${countCreated + potentialBacklog}`);

  console.log(`\n2. LEADS PERDIDOS (Target: 37)`);
  console.log(`   - New Leads Lost in Dec: ${lostNew}`);
  console.log(`   - Backlog Leads Lost in Dec: ${lostBacklog}`);
  console.log(`   - SUM: ${lostNew + lostBacklog}`);

  console.log(`\n--- LOST DEALS DETAILS ---`);
  lostDetails.forEach(d => {
    console.log(`[${d.type}] "${d.title}" (ID: ${d.id})`);
    console.log(`   PhaseID: ${d.phaseId}`);
    console.log(`   Dates -> Created: ${d.created.toISOString()} | Finished: ${d.finished ? d.finished.toISOString() : 'NULL'} | Updated: ${d.updated.toISOString()}`);
    console.log('---');
  });
}

fetchAllCards();
