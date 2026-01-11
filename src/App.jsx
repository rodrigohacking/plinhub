import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { CompanySelection } from './components/CompanySelection';
import { DashboardSales } from './components/DashboardSales';
import { DashboardMarketing } from './components/DashboardMarketing';
import { Forms } from './components/Forms';
import { AdminSettings } from './components/AdminSettings';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { SidebarNew } from './components/SidebarNew';
import { getData } from './lib/storage';
import { Loading } from './components/Loading';
import { UserProfile } from './components/UserProfile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';

function MainApp() {
    console.log("APP: Minimal Render Start");
    const { user, loading: authLoading } = useAuth();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentView, setCurrentView] = useState('sales');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const handleViewChange = (view) => {
        if (view === currentView) return;

        setIsTransitioning(true);
        setTimeout(() => {
            if (view === 'home') {
                setSelectedCompany(null);
                updateUrl(null, null);
            } else {
                setCurrentView(view);
                updateUrl(selectedCompany?.id, view);
            }
            setIsTransitioning(false);
        }, 600);
    };

    // Helper to sync URL
    const updateUrl = (companyId, view) => {
        if (!companyId) {
            window.history.pushState({}, '', '/');
            return;
        }
        const params = new URLSearchParams();
        params.set('companyId', companyId);
        if (view) params.set('view', view);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({}, '', newUrl);
    };

    useEffect(() => {
        if (user) {
            // Reset state on login to prevent stale data
            setData(null);
            setSelectedCompany(null);
            setIsLoading(true);

            console.log("APP: Loading Data...");
            getData().then(d => {
                console.log("APP: Data Loaded", d);
                setData(d);
                setIsLoading(false);

                // URL Persistence: Restore State
                const params = new URLSearchParams(window.location.search);
                const urlCompanyId = params.get('companyId');
                const urlView = params.get('view');

                if (urlCompanyId) {
                    // Note: IDs in URL are strings, IDs in data might be numbers. standardizing on loose comparison or toString
                    const found = d.companies.find(c => String(c.id) === String(urlCompanyId));
                    if (found) {
                        setSelectedCompany(found);
                        if (urlView) setCurrentView(urlView);
                    }
                }
            }).catch(e => console.error("APP: Data Load Error", e));
        }
    }, [user?.id]);

    if (authLoading) return <Loading />;
    if (!user) return <LoginPage />;

    // Diagnostic Check: if !data, show minimal loading
    if (!data) return <Loading />;

    if (!selectedCompany) {
        console.log("APP: Rendering CompanySelection");
        return <CompanySelection data={data} onSelect={(c) => {
            console.log("APP: Selected", c);
            setSelectedCompany(c);
            updateUrl(c.id, currentView);
        }} />;
    }

    const renderView = () => {
        switch (currentView) {
            case 'sales':
                return <DashboardSales data={data} company={selectedCompany} />;
            case 'marketing':
                return <DashboardMarketing data={data} company={selectedCompany} />;
            case 'settings':
                return <AdminSettings data={data} company={selectedCompany} />;
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
                onViewChange={(view) => {
                    if (view === 'home') {
                        setSelectedCompany(null);
                        updateUrl(null, null);
                    } else {
                        setCurrentView(view);
                        updateUrl(selectedCompany?.id, view);
                    }
                }}
                company={selectedCompany}
            >
                {renderView()}
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
            <MainApp />
        </AuthProvider>
    );
}

export default App;
