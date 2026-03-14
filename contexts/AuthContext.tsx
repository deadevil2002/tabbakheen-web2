import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { User, UserRole } from '@/types';
import { isFirebaseConfigured, getFirebaseAuth } from '@/services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  fsGetUser,
  fsCreateUser,
  fsUpdateUser,
} from '@/services/firestoreUsers';
import { MOCK_CUSTOMER, MOCK_PROVIDERS, MOCK_DRIVERS } from '@/mocks/data';
import { generateId } from '@/utils/helpers';

const AUTH_KEY = 'tabbakheen_auth';
const USERS_KEY = 'tabbakheen_users';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fb = isFirebaseConfigured();

  useEffect(() => {
    if (!fb) {
      loadMockSession();
      return;
    }

    console.log('[Auth] Setting up Firebase auth listener');
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('[Auth] Firebase user detected:', firebaseUser.uid);
        try {
          const userDoc = await fsGetUser(firebaseUser.uid);
          if (userDoc) {
            setUser(userDoc);
            console.log('[Auth] User doc loaded, role:', userDoc.role);
          } else {
            console.log('[Auth] No Firestore user doc for:', firebaseUser.uid);
            setUser(null);
          }
        } catch (e) {
          console.log('[Auth] Error loading user doc:', e);
          setUser(null);
        }
      } else {
        console.log('[Auth] No Firebase user');
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [fb]);

  const loadMockSession = async () => {
    try {
      const [sessionData, usersData] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEY),
        AsyncStorage.getItem(USERS_KEY),
      ]);

      if (!usersData) {
        const allUsers = [MOCK_CUSTOMER, ...MOCK_PROVIDERS, ...MOCK_DRIVERS];
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
      }

      if (sessionData) {
        const uid = sessionData;
        const users = usersData
          ? JSON.parse(usersData)
          : [MOCK_CUSTOMER, ...MOCK_PROVIDERS, ...MOCK_DRIVERS];
        const found = users.find((u: User) => u.uid === uid);
        if (found) {
          setUser(found);
        }
      }
    } catch (e) {
      console.log('[Auth] Error loading mock session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      if (!fb) {
        const usersData = await AsyncStorage.getItem(USERS_KEY);
        const users: User[] = usersData
          ? JSON.parse(usersData)
          : [MOCK_CUSTOMER, ...MOCK_PROVIDERS, ...MOCK_DRIVERS];
        const found = users.find((u) => u.email === email);
        if (!found) throw new Error('USER_NOT_FOUND');
        await AsyncStorage.setItem(AUTH_KEY, found.uid);
        setUser(found);
        return found;
      }

      try {
        const auth = getFirebaseAuth();
        const credential = await signInWithEmailAndPassword(auth, email, password);
        console.log('[Auth] Firebase login success:', credential.user.uid);
        const userDoc = await fsGetUser(credential.user.uid);
        if (!userDoc) throw new Error('USER_NOT_FOUND');
        setUser(userDoc);
        return userDoc;
      } catch (error: any) {
        console.log('[Auth] Login error:', error.code, error.message);
        if (
          error.code === 'auth/user-not-found' ||
          error.code === 'auth/invalid-credential'
        ) {
          throw new Error('USER_NOT_FOUND');
        }
        if (error.code === 'auth/wrong-password') {
          throw new Error('WRONG_PASSWORD');
        }
        if (error.code === 'auth/invalid-email') {
          throw new Error('INVALID_EMAIL');
        }
        if (error.code === 'auth/too-many-requests') {
          throw new Error('TOO_MANY_REQUESTS');
        }
        if (error.message === 'USER_NOT_FOUND') throw error;
        throw new Error('AUTH_ERROR');
      }
    },
    [fb],
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      displayName: string;
      phone: string;
      role: UserRole;
    }): Promise<User> => {
      if (!fb) {
        const usersData = await AsyncStorage.getItem(USERS_KEY);
        const users: User[] = usersData
          ? JSON.parse(usersData)
          : [MOCK_CUSTOMER, ...MOCK_PROVIDERS, ...MOCK_DRIVERS];
        const exists = users.find((u) => u.email === data.email);
        if (exists) throw new Error('EMAIL_EXISTS');

        const newUser: User = {
          uid: generateId(),
          email: data.email,
          displayName: data.displayName,
          phone: data.phone,
          role: data.role,
          photoUrl: '',
          socialLink: '',
          location:
            data.role !== 'customer' ? { lat: 24.7136, lng: 46.6753 } : null,
          address: '',
          ratingAverage: 0,
          ratingCount: 0,
          fcmToken: '',
          createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        await AsyncStorage.setItem(AUTH_KEY, newUser.uid);
        setUser(newUser);
        return newUser;
      }

      try {
        const auth = getFirebaseAuth();
        const credential = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password,
        );
        console.log('[Auth] Firebase register success:', credential.user.uid);

        const newUser: User = {
          uid: credential.user.uid,
          email: data.email,
          displayName: data.displayName,
          phone: data.phone,
          role: data.role,
          photoUrl: '',
          socialLink: '',
          location:
            data.role !== 'customer' ? { lat: 24.7136, lng: 46.6753 } : null,
          address: '',
          ratingAverage: 0,
          ratingCount: 0,
          fcmToken: '',
          createdAt: new Date().toISOString(),
        };

        await fsCreateUser(newUser);
        console.log('[Auth] Firestore user doc created for:', newUser.uid);
        setUser(newUser);
        return newUser;
      } catch (error: any) {
        console.log('[Auth] Register error:', error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
          throw new Error('EMAIL_EXISTS');
        }
        if (error.code === 'auth/weak-password') {
          throw new Error('WEAK_PASSWORD');
        }
        if (error.code === 'auth/invalid-email') {
          throw new Error('INVALID_EMAIL');
        }
        throw new Error('AUTH_ERROR');
      }
    },
    [fb],
  );

  const logout = useCallback(async () => {
    if (fb) {
      try {
        const auth = getFirebaseAuth();
        await signOut(auth);
        console.log('[Auth] Firebase signOut success');
      } catch (e) {
        console.log('[Auth] Firebase signOut error:', e);
      }
    }
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, [fb]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;

      if (fb) {
        try {
          await fsUpdateUser(user.uid, updates);
          setUser((prev) => (prev ? { ...prev, ...updates } : prev));
          console.log('[Auth] User profile updated via Firestore');
        } catch (e) {
          console.log('[Auth] updateUser Firestore error:', e);
          throw e;
        }
        return;
      }

      const usersData = await AsyncStorage.getItem(USERS_KEY);
      const users: User[] = usersData ? JSON.parse(usersData) : [];
      const idx = users.findIndex((u) => u.uid === user.uid);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updates };
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        setUser(users[idx]);
      }
    },
    [user, fb],
  );

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
  };
});
