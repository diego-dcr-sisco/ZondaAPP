import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { useAuth } from './context/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const colorScheme = useColorScheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Por favor ingresa un correo válido');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      // El manejo de errores específicos ya está en el AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.keyboardView, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
    >
      <ThemedView style={styles.container}>
        <ThemedView style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
            ¡Bienvenido!
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Ingresa tus credenciales para continuar
          </ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.formContainer}>
          <ThemedView style={[
            styles.inputContainer,
            { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].inputBorder,
            }
          ]}>
            <Ionicons 
              name="mail-outline"
              size={20}
              color={Colors[colorScheme ?? 'light'].tabIconDefault}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  color: Colors[colorScheme ?? 'light'].text,
                }
              ]}
              placeholder="Correo electrónico"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />
          </ThemedView>
          
          <ThemedView style={[
            styles.inputContainer,
            { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].inputBorder,
            }
          ]}>
            <Ionicons 
              name="lock-closed-outline"
              size={20}
              color={Colors[colorScheme ?? 'light'].tabIconDefault}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  color: Colors[colorScheme ?? 'light'].text,
                }
              ]}
              placeholder="Contraseña"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!isLoading}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={isLoading}
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={24}
                color={Colors[colorScheme ?? 'light'].tint}
              />
            </TouchableOpacity>
          </ThemedView>
          
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Colors[colorScheme ?? 'light'].tint },
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Iniciar Sesión</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <ThemedText style={[styles.versionText, { color: Colors[colorScheme ?? 'light'].tabIconDefault }]}>
          Versión 2.0.0
        </ThemedText>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: 40,
  },
  logo: {
    width: Math.min(200, width * 0.4),
    height: Math.min(200, width * 0.4),
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  inputIcon: {
    padding: 15,
  },
  eyeIcon: {
    padding: 15,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    paddingRight: 15,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  versionText: {
    fontSize: 12,
    marginBottom: 10,
  },
}); 