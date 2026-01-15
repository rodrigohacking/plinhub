import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getCompaniesConfig, saveCompanyConfig } from '../lib/storage';
import { Upload, CheckCircle, RefreshCw } from 'lucide-react';

export function AutoSyncHandler() {
    const [status, setStatus] = useState('idle'); // idle, syncing, success, error

    useEffect(() => {
        const runAutoSync = async () => {
            console.log("[AutoSync] PAUSED for debugging.");
            return;

            // 1. Get Local Data
            let localCompanies = getCompaniesConfig();

            // Fallback: Check legacy monolithic storage if separate config is empty
            if (!localCompanies || localCompanies.length === 0) {
                try {
                    const legacyRaw = localStorage.getItem('plin_system_data_v4');
                    if (legacyRaw) {
                        const legacyData = JSON.parse(legacyRaw);
                        if (legacyData.companies && Array.isArray(legacyData.companies)) {
                            console.log("[AutoSync] Found companies in legacy storage. Using them.");
                            localCompanies = legacyData.companies;
                        }
                    }
                } catch (e) {
                    console.warn("[AutoSync] Legacy storage check failed", e);
                }
            }

            if (!localCompanies || localCompanies.length === 0) {
                console.log("[AutoSync] No local companies found to sync.");
                return;
            }
            // We want to sync REAL companies user created.
            // Check if we have connectivity first (simple ping or just try)

            // Optimization: Only sync if we suspect drift? 
            // For now, per user request "AUTOMATIC", we will aggressively sync local -> cloud 
            // on every mount to ensure consistency. Ideally we'd compare timestamps.

            setStatus('syncing');
            let successCount = 0;
            let errorCount = 0;

            console.log(`[AutoSync] Found ${localCompanies.length} local companies. Starting sync...`);

            const promises = localCompanies.map(async (company) => {
                // Skip invalid companies
                if (!company.id || !company.name) return;

                try {
                    // Reuse the existing robust save function which calls POST /api/companies
                    // Note: ensure saveCompanyConfig handles "upsert" correctly (it does)
                    await saveCompanyConfig(company);
                    successCount++;
                } catch (e) {
                    console.error(`[AutoSync] Failed to sync ${company.name}`, e);
                    errorCount++;
                }
            });

            await Promise.all(promises);

            if (successCount > 0) {
                console.log(`[AutoSync] Successfully synced ${successCount} companies.`);
                setStatus('success');
                // Only show toast if it actually did something useful or if DB was likely empty
                // To avoid spam, we can throttle this or check sessionStorage
                const hasSynced = sessionStorage.getItem('plin_initial_sync_done');
                if (!hasSynced) {
                    toast.success(`${successCount} empresas sincronizadas com a nuvem!`, {
                        icon: <Upload className="w-4 h-4" />,
                        duration: 4000
                    });
                    sessionStorage.setItem('plin_initial_sync_done', 'true');
                }
            } else if (errorCount > 0) {
                setStatus('error');
            } else {
                setStatus('idle');
            }

            // Fade out status after a few seconds
            setTimeout(() => setStatus('idle'), 5000);
        };

        // Run on mount
        runAutoSync();
    }, []);

    if (status === 'syncing') {
        return (
            <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-full shadow-lg z-[100] flex items-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sincronizando dados globais...
            </div>
        );
    }

    if (status === 'success') {
        return null; // Toast handles visibility
    }

    return null;
}
