const axios = require('axios');
async function inspectFields() {
    const token = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';
    const pipeId = '306438109';
    const query = `query($pipeId: ID!) { 
    allCards(pipeId: $pipeId, first: 10) { 
        edges { 
            node { 
                id 
                title 
                fields { name value } 
            } 
        } 
    } 
  }`;
    try {
        const res = await axios.post('https://api.pipefy.com/graphql', { query, variables: { pipeId } }, { headers: { 'Authorization': 'Bearer ' + token } });
        const cards = res.data.data.allCards.edges;
        cards.forEach(c => {
            console.log(`\nCard: ${c.node.title}`);
            console.log(c.node.fields);
        });
    } catch (e) { console.error(e.message); }
}
inspectFields();
