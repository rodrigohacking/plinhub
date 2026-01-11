const axios = require('axios');

async function inspectCards() {
    const token = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';
    const pipeId = '306438109';

    try {
        const response = await axios.post('https://api.pipefy.com/graphql', {
            query: `query($pipeId: ID!) { 
        allCards(pipeId: $pipeId, first: 100) {
          edges {
            node {
              id
              title
              current_phase { name }
              created_at
              finished_at
              updated_at
              labels { name }
            }
          }
        }
      }`,
            variables: { pipeId }
        }, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const cards = response.data.data.allCards.edges.map(e => e.node);

        console.log('Total cards fetched:', cards.length);

        const wonCards = cards.filter(c => c.current_phase.name === 'Fechamento - Ganho');
        console.log('\nExemplos de Fechamento - Ganho:');
        wonCards.slice(0, 5).forEach(c => {
            console.log(`- ${c.title} | Criado: ${c.created_at} | Finalizado: ${c.finished_at}`);
        });

        const lostCards = cards.filter(c => c.current_phase.name === 'Fechamento - Perdido');
        console.log('\nExemplos de Fechamento - Perdido:');
        lostCards.slice(0, 5).forEach(c => {
            console.log(`- ${c.title} | Criado: ${c.created_at} | Finalizado: ${c.finished_at}`);
        });

        const qualCards = cards.filter(c => c.current_phase.name === 'Qualificação');
        console.log('\nExemplos de Qualificação:');
        qualCards.slice(0, 5).forEach(c => {
            console.log(`- ${c.title} | Criado: ${c.created_at}`);
        });

    } catch (error) {
        console.error('Erro:', error.message);
    }
}

inspectCards();
