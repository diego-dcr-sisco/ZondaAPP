import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { logout, user } = useAuth();
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Mi Perfil</ThemedText>
      </View>

      <View style={styles.profileSection}>
        <View style={[
          styles.avatarContainer,
          { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground }
        ]}>
          <Ionicons
            name="person"
            size={40}
            color={Colors[colorScheme ?? 'light'].tint}
          />
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <ThemedText style={styles.label}>Nombre:</ThemedText>
            <ThemedText style={styles.value}>{user?.username || 'N/A'}</ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={styles.label}>Correo:</ThemedText>
            <ThemedText style={styles.value}>{user?.email || 'N/A'}</ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={styles.label}>ID:</ThemedText>
            <ThemedText style={styles.value}>{user?.userId || 'N/A'}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={24} color="#fff" style={styles.logoutIcon} />
          <ThemedText style={styles.buttonText}>Cerrar Sesión</ThemedText>
        </TouchableOpacity>

        <ThemedText style={[styles.versionText, { color: Colors[colorScheme ?? 'light'].tabIconDefault }]}>
          Versión 2.0.0
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: Colors.light.inputBackground,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  value: {
    flex: 2,
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  logoutIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  versionText: {
    fontSize: 12,
  },
}); 