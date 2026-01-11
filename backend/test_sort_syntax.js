
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function testSortSyntax() {
    const query = `
    query {
      allCards(pipeId: ${PIPE_ID}, first: 10, sort: { field: updated_at, direction: desc }) {
        edges {
          node {
            id
            title
            created_at
            updated_at
          }
        }
      }
    }
  `;

    try {
        const response = await axios.post(
            'https://api.pipefy.com/graphql',
            { query },
            {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.errors) {
            console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
            return;
        }

        const cards = response.data.data.allCards.edges.map(e => e.node);
        console.log("First 10 cards returned by allCards (updated_at DESC):");
        cards.forEach(c => {
            console.log(`ID: ${c.id} | Created: ${c.created_at} | Updated: ${c.updated_at} | Title: ${c.title}`);
        });

    } catch (error) {
        console.error("Network/Axios Error:", error.response?.data || error.message);
    }
}

testSortSyntax();
