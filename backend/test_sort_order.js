
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function testSortOrder() {
    const query = `
    query {
      allCards(pipeId: ${PIPE_ID}, first: 10) {
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

        const cards = response.data.data.allCards.edges.map(e => e.node);
        console.log("First 10 cards returned by allCards (default sort):");
        cards.forEach(c => {
            console.log(`ID: ${c.id} | Created: ${c.created_at} | Updated: ${c.updated_at} | Title: ${c.title}`);
        });

    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
}

testSortOrder();
