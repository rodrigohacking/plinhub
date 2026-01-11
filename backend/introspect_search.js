
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function introspectSchema() {
    const query = `
    query {
      __type(name: "AdvancedSearch") {
        name
        inputFields {
          name
          type {
            name
            kind
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
        } else {
            console.log("AdvancedSearch Input Fields:");
            console.log(JSON.stringify(response.data.data.__type, null, 2));
        }

    } catch (error) {
        console.error("Network/Axios Error:", error.response?.data || error.message);
    }
}

introspectSchema();
