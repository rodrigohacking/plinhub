const axios = require('axios');

async function deepInspect() {
    const token = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';
    const pipeId = '306438109';

    const query = `
    query($pipeId: ID!) {
      pipe(id: $pipeId) {
        phases {
          id
          name
          cards(first: 10) {
            edges {
              node {
                id
                title
                created_at
                updated_at
                finished_at
                labels { name }
                fields { name value }
              }
            }
          }
        }
      }
    }
  `;

    try {
        const response = await axios.post('https://api.pipefy.com/graphql', {
            query,
            variables: { pipeId }
        }, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const phases = response.data.data.pipe.phases;

        phases.forEach(phase => {
            const cards = phase.cards.edges.map(e => e.node);
            if (cards.length > 0) {
                console.log(`\n=== FASE: ${phase.name} (${cards.length} cards) ===`);
                cards.forEach(card => {
                    const labelNames = card.labels.map(l => l.name).join(', ');
                    console.log(`- Card: ${card.title}`);
                    console.log(`  Criado: ${card.created_at} | Atualizado: ${card.updated_at} | Finalizado: ${card.finished_at}`);
                    console.log(`  Tags/Labels: [${labelNames}]`);
                });
            }
        });

    } catch (error) {
        console.error('Erro:', error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

deepInspect();
