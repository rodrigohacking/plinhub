
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function testFilter() {
    const queryOps = `
    query {
      __type(name: "AdvancedSearchOperators") {
        enumValues {
          name
        }
      }
    }
  `;

    try {
        // 1. Get Operators
        const resOps = await axios.post('https://api.pipefy.com/graphql', { query: queryOps }, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log("Operators:", resOps.data.data?.__type?.enumValues?.map(v => v.name));

        // 2. Test Filter
        // Guessing operator based on common names, but will use GTE if available or similar
        // We will wait for step 1 output usually, but let's try a safe bet or just print ops first
        // Actually, I'll just print ops first to be sure.

        // Trying a test filter assuming 'gte' or similar exists, but I'll comment it out or try a safe 'equals' to test 'updated_at' field validity first?
        // No, let's try to query with what looks like standard operators (usually gt, lt, gte, lte, eq, like)

        const queryFilter = `
        query {
          allCards(pipeId: ${PIPE_ID}, first: 5, filter: { field: "updated_at", operator: gte, value: "2025-12-01" }) {
            edges {
              node {
                id
                title
                updated_at
              }
            }
          }
        }
      `;
        // Note: 'gte' is an enum, so no quotes if it's an enum value in variables, but here it is inline. 
        // If it fails, I'll see the error.

        const resFilter = await axios.post('https://api.pipefy.com/graphql', { query: queryFilter }, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });

        if (resFilter.data.errors) {
            console.error("Filter Error:", JSON.stringify(resFilter.data.errors, null, 2));
        } else {
            console.log("Filter Success! Cards:", resFilter.data.data.allCards.edges.length);
        }

    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
}

testFilter();
