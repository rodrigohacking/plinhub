
import { useState } from 'react';
import { GlassCard } from './GlassCard';
import { SectionHeader } from './SectionHeader';
import { List } from 'lucide-react';

const PIPEFY_API_URL = '/api/pipefy';

export function PipeFinder({ token }) {
    const [pipes, setPipes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPipes = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);

        const query = `
        {
            organizations {
                pipes {
                    id
                    name
                }
            }
        }`;

        try {
            const res = await fetch(PIPEFY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            });
            const json = await res.json();

            if (json.errors) throw new Error(json.errors[0].message);

            // Flatten pipes from all orgs
            const allPipes = json.data.organizations.flatMap(org => org.pipes);
            setPipes(allPipes);

        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassCard className="mt-8 p-6 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
            <SectionHeader icon={List} title="Localizador de Pipes" />
            <p className="text-sm text-gray-500 mb-4">Caso não saiba o ID, clique abaixo para listar todos os pipes acessíveis com este token.</p>

            <button
                onClick={fetchPipes}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                disabled={loading}
            >
                {loading ? 'Buscando...' : 'Listar Meus Pipes'}
            </button>

            {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium">{error}</div>}

            {pipes.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                    {pipes.map(pipe => (
                        <div key={pipe.id} className="flex justify-between items-center p-3 bg-white dark:bg-black/20 rounded-lg border border-gray-100 dark:border-white/5">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{pipe.name}</span>
                            <code className="bg-gray-100 dark:bg-white/10 px-2 py-1 rounded text-xs select-all">{pipe.id}</code>
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
}
