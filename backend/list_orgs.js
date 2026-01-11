
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";

async function listOrgs() {
    const query = `
    query {
      organizations {
        id
        name
        pipes {
          id
          name
        }
      }
    }
  `;

    try {
        const res = await axios.post('https://api.pipefy.com/graphql', { query }, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });

        const orgs = res.data.data.organizations;
        orgs.forEach(org => {
            console.log(`\nORG: ${org.name} (ID: ${org.id})`);
            org.pipes.forEach(p => {
                console.log(`  - [${p.id}] ${p.name}`);
            });
        });
    } catch (error) {
        console.error("Error:", error.message);
    }
}

listOrgs();
