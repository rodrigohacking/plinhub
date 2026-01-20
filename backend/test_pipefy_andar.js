require('dotenv').config();
const pipefyService = require('./src/services/pipefy.service');

async function testPipefyAndar() {
    try {
        const token = process.env.PIPEFY_TOKEN;

        if (!token) {
            console.error('PIPEFY_TOKEN not found in environment');
            return;
        }

        console.log('Testing Pipefy connection...\n');

        // Test connection
        const connection = await pipefyService.testConnection(token);
        console.log('✓ Connection successful');
        console.log('User:', connection.user.name, '-', connection.user.email);
        console.log('');

        // Get pipe data - assuming Andar Seguros pipe ID
        // Common pipe IDs from previous context: 306438109
        const pipeId = '306438109';

        console.log(`Fetching cards from pipe ${pipeId}...\n`);
        const pipeData = await pipefyService.getPipeCards(pipeId, token);

        console.log('Pipe:', pipeData.pipe.name);
        console.log('Total cards fetched:', pipeData.cards.length);
        console.log('');

        // Analyze phases
        console.log('Phases:');
        pipeData.pipe.phases.forEach(phase => {
            console.log(`  - ${phase.name} (ID: ${phase.id}) - ${phase.cards_count} cards`);
        });
        console.log('');

        // Analyze labels
        console.log('Labels:');
        pipeData.pipe.labels.forEach(label => {
            console.log(`  - ${label.name} (${label.color})`);
        });
        console.log('');

        // Sample cards
        console.log('Sample cards (first 5):');
        pipeData.cards.slice(0, 5).forEach((card, i) => {
            console.log(`\n${i + 1}. ${card.title}`);
            console.log(`   Phase: ${card.current_phase?.name || 'N/A'}`);
            console.log(`   Labels: ${card.labels?.map(l => l.name).join(', ') || 'None'}`);
            console.log(`   Created: ${card.created_at}`);

            // Show custom fields
            if (card.fields && card.fields.length > 0) {
                console.log('   Fields:');
                card.fields.forEach(f => {
                    if (f.value) {
                        console.log(`     - ${f.name}: ${f.value}`);
                    }
                });
            }
        });

        // Analyze won/closed deals
        const wonPhaseIds = ['338889923', '338889934'];
        const wonCards = pipeData.cards.filter(c =>
            wonPhaseIds.includes(String(c.current_phase?.id)) ||
            c.current_phase?.name?.toLowerCase().includes('ganho') ||
            c.current_phase?.name?.toLowerCase().includes('fechamento')
        );

        console.log(`\n\nWon/Closed deals: ${wonCards.length}`);
        if (wonCards.length > 0) {
            console.log('Sample won deals:');
            wonCards.slice(0, 3).forEach((card, i) => {
                console.log(`  ${i + 1}. ${card.title} - Phase: ${card.current_phase?.name}`);
            });
        }

        // Check for product segmentation
        console.log('\n\nProduct segmentation analysis:');
        const productKeywords = {
            'Condominial': ['condominial', 'condomínio', 'condominio'],
            'RC Síndico': ['síndico', 'sindico', 'rc sindico'],
            'Automóvel': ['automóvel', 'automovel', 'auto'],
            'Residencial': ['residencial']
        };

        Object.keys(productKeywords).forEach(product => {
            const keywords = productKeywords[product];
            const count = pipeData.cards.filter(card => {
                const title = card.title?.toLowerCase() || '';
                const labels = card.labels?.map(l => l.name.toLowerCase()).join(' ') || '';
                const fields = card.fields?.map(f => `${f.name} ${f.value}`.toLowerCase()).join(' ') || '';

                const searchText = `${title} ${labels} ${fields}`;
                return keywords.some(k => searchText.includes(k));
            }).length;

            console.log(`  ${product}: ${count} cards`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testPipefyAndar();
