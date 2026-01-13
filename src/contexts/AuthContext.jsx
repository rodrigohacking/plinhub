import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Helper to merge local profile
        const mergeLocalProfile = (sessionUser) => {
            if (!sessionUser) return null;

            // SCOPED KEY: Use user ID to prevent data bleeding between accounts
            const storageKey = `plin_user_profile_${sessionUser.id}`;
            const savedProfile = localStorage.getItem(storageKey);

            let profile = {};

            if (savedProfile) {
                try {
                    profile = JSON.parse(savedProfile);
                    // console.log("Restoring local profile data for:", sessionUser.email);
                } catch (e) {
                    console.error("Error parsing local profile:", e);
                }
            }

            // Deep merge to ensure local changes override server/session defaults
            return {
                ...sessionUser,
                ...profile, // Apply local changes to top level
                user_metadata: {
                    ...(sessionUser.user_metadata || {}),
                    ...profile // Apply local changes to metadata
                }
            };
        };

        // Check active sessions and sets the user
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                setUser(mergeLocalProfile(session?.user ?? null));
            } catch (err) {
                console.error("Auth init error:", err);
                // If setup is missing, we just don't have a user, app remains in public/login state (or shows error)
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(mergeLocalProfile(session?.user ?? null));
            setLoading(false);
        });

        return () => subscription?.unsubscribe();
    }, []);

    const signIn = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            // Check if we are in fallback/demo mode (error says 'Supabase not configured')
            if (error && error.message === 'Supabase not configured') {
                console.warn("Supabase not configured. Logging in as DEMO user.");
                const demoUser = { id: 'demo-user', email: email || 'admin@plin.hub' };
                setUser(demoUser);
                return { user: demoUser, session: null };
            }

            if (error) throw error;

            // Restore profile from local storage if exists
            if (data.user) {
                const storageKey = `plin_user_profile_${data.user.id}`;
                const savedProfile = localStorage.getItem(storageKey);
                if (savedProfile) {
                    try {
                        const profile = JSON.parse(savedProfile);
                        data.user = {
                            ...data.user,
                            ...profile,
                            user_metadata: {
                                ...(data.user.user_metadata || {}),
                                ...profile
                            }
                        };
                    } catch (e) {
                        console.error("Error restoring profile on login:", e);
                    }
                }
            }

            return data;
        } catch (err) {
            throw err;
        }
    };

    const updateProfile = (data) => {
        if (!user) return;

        console.log("Updating profile with:", data);

        // Update both top-level and metadata for compatibility
        const updatedUser = {
            ...user,
            ...data,
            user_metadata: {
                ...(user.user_metadata || {}),
                ...data
            }
        };

        setUser(updatedUser);

        // Persist to local storage (for demo/hybrid mode)
        const storageKey = `plin_user_profile_${user.id}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn("LocalStorage save failed (likely quota exceeded). Retrying without photo.", e);
            try {
                // Retry without photoUrl if it's too big
                const { photoUrl, ...dataWithoutPhoto } = data;
                localStorage.setItem(storageKey, JSON.stringify(dataWithoutPhoto));
                console.log("Saved profile without photo as fallback.");
            } catch (retryErr) {
                console.error("Fallback save also failed:", retryErr);
            }
        }

        // Also try to update Supabase user metadata if connected
        supabase.auth.updateUser({
            data: data
        }).then(() => console.log("Supabase metadata synced"))
            .catch(err => console.warn("Supabase update failed (expected in demo):", err));
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("SignOut Error (non-blocking):", error);
        } finally {
            // Force state clear to ensure UI updates even if event doesn't fire (e.g. Demo mode)
            setUser(null);
            // Optional: Clear admin auth if used elsewhere
            sessionStorage.removeItem('plin_admin_auth');
        }
    };

    const value = {
        user,
        signIn,
        signOut,
        updateProfile,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
