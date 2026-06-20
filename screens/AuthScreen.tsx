import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) Alert.alert('Sign in failed', error.message);
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          Alert.alert('Sign up failed', error.message);
        } else {
          Alert.alert(
            'Check your email 📬',
            'We sent you a confirmation link. Click it, then sign in here.',
          );
          setMode('signin');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#EDFCE5', '#F7FFF4', '#FFFFFF']} style={styles.bg}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.wrapper}
      >
        <View style={styles.card}>
          <Text style={styles.logo}>🌱</Text>
          <Text style={styles.appName}>FocusTree</Text>
          <Text style={styles.heading}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#BBB"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#BBB"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.toggleRow}
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            <Text style={styles.toggleText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 60,
    marginBottom: 6,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E5C1E',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heading: {
    fontSize: 15,
    color: '#999',
    marginBottom: 36,
  },
  input: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#222',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#4A8230',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#4A8230',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  toggleRow: { marginTop: 22 },
  toggleText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  toggleLink: {
    color: '#4A8230',
    fontWeight: '600',
  },
});
