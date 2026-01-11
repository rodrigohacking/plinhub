
const pipefyService = require('./src/services/pipefy.service');

// Mock token - we must provide a valid one for the real call
// Since the service is just an object exported, we can use it directly if we have the token
const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function verifyService() {
    console.log("Fetching cards with updated service logic (last 2000)...");
    try {
        const data = await pipefyService.getPipeCards(PIPE_ID, TOKEN);
        const cards = data.cards;
        console.log(`Total cards fetched: ${cards.length}`);

        if (cards.length > 0) {
            // Sort explicitly by created_at just to see range
            cards.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            console.log("Oldest Card Fetched:", cards[0].created_at, cards[0].title);
            console.log("Newest Card Fetched:", cards[cards.length - 1].created_at, cards[cards.length - 1].title);

            // Check for 2026 updates
            const recentUpdates = cards.filter(c => new Date(c.updated_at).getFullYear() === 2026);
            console.log(`Cards updated in 2026: ${recentUpdates.length}`);

            if (recentUpdates.length > 0) {
                console.log("Sample 2026 Update:", recentUpdates[0].title, recentUpdates[0].updated_at);
            }
        }

    } catch (error) {
        console.error("Service Error:", error.message);
    }
}

verifyService();
