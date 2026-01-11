
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function getPhases() {
    console.log(`Fetching phases for Pipe ID: ${PIPE_ID}...`);
    const query = `
    {
        pipe(id: ${PIPE_ID}) {
            name
            phases {
                id
                name
            }
        }
    }`;

    try {
        const res = await fetch('https://api.pipefy.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ query })
        });

        const json = await res.json();
        if (json.errors) {
            console.error("Errors:", json.errors);
            return;
        }

        const pipe = json.data.pipe;
        console.log(`\nPipe: ${pipe.name}`);
        console.log("Phases:");
        pipe.phases.forEach(p => {
            console.log(`- [${p.id}] ${p.name}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

getPhases();
