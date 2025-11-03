import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import axiosInstance from '../config/axios';

type User = {
  userId: number;
  email: string;
  username: string;
  token: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        // Configurar el token para futuras peticiones
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${parsedUser.token}`;
        router.replace('/(tabs)/orders');
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      router.replace('/login');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axiosInstance.post('login', {
        email,
        password,
      });

      const userData = response.data;
      
      
      // Guardar el token para futuras peticiones
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
      
      // Guardar datos del usuario
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      setUser(userData);
      setIsAuthenticated(true);
      router.replace('/(tabs)/orders');
    } catch (error: any) {
      console.error('Error during login:', error);
      
      // Manejar diferentes tipos de errores
      if (error.response) {
        // El servidor respondió con un estado de error
        if (error.response.data?.errors?.email) {
          Alert.alert('Error', error.response.data.errors.email[0]);
        } else if (error.response.data?.message) {
          Alert.alert('Error', error.response.data.message);
        } else {
          Alert.alert('Error', 'Credenciales incorrectas');
        }
      } else if (error.request) {
        // La petición fue hecha pero no se recibió respuesta
        Alert.alert('Error', 'No se pudo conectar con el servidor');
      } else {
        // Error al configurar la petición
        Alert.alert('Error', 'Ocurrió un error al intentar iniciar sesión');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Limpiar token del header
      delete axiosInstance.defaults.headers.common['Authorization'];
      
      // Limpiar storage
      await AsyncStorage.removeItem('userData');
      
      setUser(null);
      setIsAuthenticated(false);
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Error', 'Ocurrió un error al cerrar sesión');
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 