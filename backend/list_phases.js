const axios = require('axios');

async function listPhases() {
    const token = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';
    const pipeId = '306438109';

    try {
        const response = await axios.post('https://api.pipefy.com/graphql', {
            query: `query($pipeId: ID!) { 
        pipe(id: $pipeId) { 
          phases { 
            name 
          } 
        } 
      }`,
            variables: { pipeId }
        }, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const phases = response.data.data.pipe.phases;
        console.log('ESTAGIOS_PIPEFY:');
        phases.forEach((p, i) => console.log((i + 1) + '. ' + p.name));
    } catch (error) {
        console.error('Erro:', error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

listPhases();
