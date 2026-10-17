import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('worksphere_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('worksphere_token');
      const storedUserData = localStorage.getItem('worksphere_user');

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        if (storedUserData) {
          setUser(JSON.parse(storedUserData));
        }
        const profile = await authApi.getMe();
        setUser((prev) => ({
          ...prev,
          ...profile,
        }));
        localStorage.setItem('worksphere_user', JSON.stringify({ ...profile, token: storedToken }));
      } catch (err) {
        console.warn('Session expired or invalid token:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.access_token);
    setUser(data);
    localStorage.setItem('worksphere_token', data.access_token);
    localStorage.setItem('worksphere_user', JSON.stringify(data));
    return data;
  };

  const register = async (email, password, role = 'EMPLOYEE') => {
    const data = await authApi.register(email, password, role);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('worksphere_token');
    localStorage.removeItem('worksphere_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

