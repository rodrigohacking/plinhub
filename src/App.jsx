import React, { useState, useEffect, Suspense } from 'react';
import { Layout } from './components/Layout';
// Lazy Loading for optimization
const CompanySelection = React.lazy(() => import('./components/CompanySelection').then(module => ({ default: module.CompanySelection })));
const DashboardSales = React.lazy(() => import('./components/DashboardSales').then(module => ({ default: module.DashboardSales })));
const DashboardMarketing = React.lazy(() => import('./components/DashboardMarketing').then(module => ({ default: module.DashboardMarketing })));
const Forms = React.lazy(() => import('./components/Forms').then(module => ({ default: module.Forms })));
const AdminSettings = React.lazy(() => import('./components/AdminSettings').then(module => ({ default: module.AdminSettings })));
const UserProfile = React.lazy(() => import('./components/UserProfile').then(module => ({ default: module.UserProfile })));

import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { SidebarNew } from './components/SidebarNew';
import { getData } from './lib/storage';
import { Loading } from './components/Loading';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AutoSyncHandler } from './components/AutoSyncHandler';

function MainApp() {
    console.log("APP: Minimal Render Start");
    const { user, loading: authLoading } = useAuth();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentView, setCurrentView] = useState('sales');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    // Peristent Date Filter
    const [dateRange, setDateRange] = useState(() => {
        return localStorage.getItem('plin_date_range') || 'this-month';
    });

    // Save dateRange to localStorage when changed
    useEffect(() => {
        localStorage.setItem('plin_date_range', dateRange);
    }, [dateRange]);
    
    // Check if this is the first boot in this browser session
    const isFirstSessionBoot = !sessionStorage.getItem('plin_boot_done');

    useEffect(() => {
        if (!authLoading && user && !isFirstSessionBoot) {
            // If already loaded once, we mark it.
        }
    }, [authLoading, user]);

    const handleViewChange = (view) => {
        if (view === currentView) return;

        setIsTransitioning(true);
        setTimeout(() => {
            if (view === 'home') {
                setSelectedCompany(null);
                updateUrl(null, null);
                localStorage.removeItem('plin_company_id'); // Clear persistent choice
            } else {
                setCurrentView(view);
                updateUrl(selectedCompany?.id, view);
            }
            setIsTransitioning(false);
        }, 600);
    };

    // Helper to sync URL (Clean Version)
    const updateUrl = (companyId, view) => {
        if (!companyId) {
            window.history.pushState({}, '', '/');
            return;
        }

        // Save to LocalStorage for persistence
        localStorage.setItem('plin_company_id', companyId);

        let path = '/';
        const params = new URLSearchParams();

        // View -> Path Mapping
        if (view === 'sales') {
            path = '/vendas-geral';
            // Don't add companyId to params for cleaner URL
        } else if (view === 'marketing') {
            path = '/marketing';
        } else if (view === 'settings') {
            path = '/settings';
        } else if (view === 'set-goals') {
            path = '/definir-metas';
        } else if (view === 'profile') {
            path = '/perfil';
        } else {
            // Default fallback for other views
            params.set('view', view);
        }

        // Only append params if there are any
        const queryString = params.toString();
        const finalUrl = queryString ? `${path}?${queryString}` : path;

        window.history.pushState({}, '', finalUrl);
    };

    // Force redirect /home -> /
    useEffect(() => {
        if (window.location.pathname === '/home') {
            window.history.replaceState({}, '', '/');
        }
    }, []);

    useEffect(() => {
        if (user) {
            // Reset state on login
            setData(null);
            setSelectedCompany(null);
            setIsLoading(true);

            console.log("APP: Loading Data...");
            getData(dateRange).then(d => {
                console.log("APP: Data Loaded", d);
                setData(d);
                setIsLoading(false);

                // URL Persistence: Support both URL param (shareable links) AND LocalStorage (returning user)
                const params = new URLSearchParams(window.location.search);
                let targetCompanyId = params.get('companyId');
                const urlView = params.get('view');
                const pathname = window.location.pathname;

                // Fallback to LocalStorage if not in URL
                if (!targetCompanyId) {
                    targetCompanyId = localStorage.getItem('plin_company_id');
                }

                if (targetCompanyId) {
                    const found = d.companies.find(c => String(c.id) === String(targetCompanyId));
                    if (found) {
                        setSelectedCompany(found);

                        // Restore View based on Path or Param
                        if (pathname === '/vendas-geral') setCurrentView('sales');
                        else if (pathname === '/marketing') setCurrentView('marketing');
                        else if (pathname === '/settings') setCurrentView('settings');
                        else if (pathname === '/definir-metas') setCurrentView('set-goals');
                        else if (pathname === '/perfil') setCurrentView('profile');
                        else if (urlView) setCurrentView(urlView);
                    }
                }
            }).catch(e => console.error("APP: Data Load Error", e));
        }
    }, [user?.id, dateRange]); // Re-fetch when dateRange changes

    // SILENT SYNC: Reactivate metrics if zeroed
    useEffect(() => {
        if (selectedCompany && data) {
            const hasData = (data.campaigns || []).some(c => String(c.companyId) === String(selectedCompany.id)) ||
                           (data.sales || []).some(s => String(s.companyId) === String(selectedCompany.id));
            
            if (!hasData) {
                console.log(`[The Comeback] Silent sync triggered for ${selectedCompany.name}...`);
                fetch(`/api/sync/${selectedCompany.id}/force`, { method: 'POST' })
                    .then(res => {
                        if (res.ok) {
                             // Refresh data after sync
                             return getData();
                        }
                    })
                    .then(freshData => {
                        if (freshData) {
                            console.log("[The Comeback] Data restored successfully.");
                            setData(freshData);
                        }
                    })
                    .catch(err => console.error("Silent sync failed", err));
            }
        }
    }, [selectedCompany?.id, !!data]);

    // URL Management for Login State - PRESERVE PATH ON REFRESH
    useEffect(() => {
        if (!authLoading) {
            const path = window.location.pathname;
            if (!user) {
                // If not logged in and not on /login, move to /login 
                // but save where we were to return later if desired
                if (path !== '/login') {
                    sessionStorage.setItem('plin_redirect_after_login', path);
                    window.history.replaceState({}, '', '/login');
                }
            } else {
                // If logged in and on /login, move to root or restore saved path
                if (path === '/login') {
                    const savedPath = sessionStorage.getItem('plin_redirect_after_login');
                    if (savedPath && savedPath !== '/login') {
                        window.history.replaceState({}, '', savedPath);
                        sessionStorage.removeItem('plin_redirect_after_login');
                    } else {
                        window.history.replaceState({}, '', '/');
                    }
                }
            }
        }
    }, [authLoading, user]);

    if (authLoading) return <Loading variant={isFirstSessionBoot ? 'boot' : 'simple'} />;
    if (!user) return <LoginPage />;

    // Diagnostic Check: if !data, show minimal loading
    if (!data) return <Loading variant="simple" />;

    // If we reached here, data is loaded and user is auth
    // Mark boot as done after a small delay so user sees the animation first time
    if (isFirstSessionBoot && data) {
        setTimeout(() => {
            sessionStorage.setItem('plin_boot_done', 'true');
        }, 5000); // Wait for the typing animation to reach a good point
    }

    if (!selectedCompany) {
        console.log("APP: Rendering CompanySelection");
        return (
            <Suspense fallback={<Loading />}>
                <CompanySelection data={data} onSelect={(c) => {
                    console.log("APP: Selected", c);

                    // 1. Immediate Navigation (Optimistic UI)
                    setSelectedCompany(c);
                    setCurrentView('sales');
                    updateUrl(c.id, 'sales');

                    // 2. Background Refresh (Don't await)
                    getData().then(freshData => {
                        console.log("APP: Background Refresh Complete");
                        setData(freshData);
                    }).catch(error => {
                        console.error("APP: Background refresh failed", error);
                    });
                }} />
            </Suspense>
        );
    }

    const renderView = () => {
        switch (currentView) {
            case 'sales':
                return <DashboardSales data={data} company={selectedCompany} dateRange={dateRange} setDateRange={setDateRange} />;
            case 'marketing':
                return <DashboardMarketing
                    data={data}
                    company={selectedCompany}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    onRefresh={() => {
                        setIsLoading(true);
                        getData().then(d => {
                            setData(d);
                            setIsLoading(false);
                        });
                    }}
                />;
            case 'settings':
                return <AdminSettings
                    data={data}
                    company={selectedCompany}
                    onSave={() => {
                        console.log("APP: Settings Saved. Refreshing Data...");
                        getData().then(freshData => {
                            setData(freshData);
                            if (selectedCompany) {
                                const updatedSelf = freshData.companies.find(c => c.id === selectedCompany.id);
                                if (updatedSelf) setSelectedCompany(updatedSelf);
                            }
                        });
                    }}
                />;
            case 'add-sale':
                return <Forms type="add-sale" data={data} company={selectedCompany} onSuccess={() => {
                    setCurrentView('sales');
                    updateUrl(selectedCompany.id, 'sales');
                }} />;
            case 'add-campaign':
                return <Forms type="add-campaign" data={data} company={selectedCompany} onSuccess={() => {
                    setCurrentView('marketing');
                    updateUrl(selectedCompany.id, 'marketing');
                }} />;
            case 'set-goals':
                return <Forms type="set-goals" data={data} company={selectedCompany} onSuccess={() => {
                    setIsLoading(true);
                    getData().then(d => {
                        setData(d);
                        setIsLoading(false);
                        setCurrentView('sales');
                        updateUrl(selectedCompany.id, 'sales');
                    });
                }} />;
            case 'profile':
                return <UserProfile data={data} company={selectedCompany} />;
            default:
                return <DashboardSales data={data} company={selectedCompany} />;
        }
    };

    return (
        <>
            <Layout
                currentView={currentView}
                onViewChange={handleViewChange}
                company={selectedCompany}
            >
                <Suspense fallback={<Loading />}>
                    {renderView()}
                </Suspense>
            </Layout>
            <Toaster
                richColors
                position="top-right"
                expand={true}
                visibleToasts={3}
                style={{ zIndex: 99999 }}
            />
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <AutoSyncHandler />
            <MainApp />
        </AuthProvider>
    );
}

export default App;
