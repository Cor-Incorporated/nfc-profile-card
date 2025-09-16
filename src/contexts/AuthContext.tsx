'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const googleProvider = new GoogleAuthProvider();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isInitialLoad = true;

    // リダイレクト結果を処理
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          await createOrUpdateUserDocument(result.user);
          // 認証トークンをクッキーに保存
          const token = await result.user.getIdToken();
          Cookies.set('auth-token', token, { expires: 7 });
          // ブラウザを完全にリロードして、ミドルウェアが新しいクッキーを認識できるようにする
          window.location.href = '/dashboard';
        }
      })
      .catch((error) => {
        console.error('Redirect sign in error:', error);
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        // ユーザードキュメントを作成/更新
        await createOrUpdateUserDocument(user);
        // 認証トークンをクッキーに保存
        const token = await user.getIdToken();
        Cookies.set('auth-token', token, { expires: 7 });

        // 初回ロード時かつサインインページにいる場合はダッシュボードへリダイレクト
        if (isInitialLoad && window.location.pathname === '/signin') {
          window.location.href = '/dashboard';
        }
      } else {
        // ログアウト時はクッキーを削除
        Cookies.remove('auth-token');
      }

      setLoading(false);
      isInitialLoad = false;
    });

    return () => unsubscribe();
  }, []);

  const createOrUpdateUserDocument = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists()) {
      // 新規ユーザーの場合
      await setDoc(userRef, {
        ...userData,
        username: user.email?.split('@')[0] || user.uid,
        createdAt: serverTimestamp(),
        name: user.displayName || '',
        bio: '',
        company: '',
        position: '',
        phone: '',
        website: '',
        address: '',
        links: [],
        cards: [],
        subscription: {
          plan: 'free',
          startedAt: serverTimestamp(),
        }
      });
    } else {
      // 既存ユーザーの場合は更新
      await setDoc(userRef, userData, { merge: true });
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      // リダイレクト方式を使用してCOOPエラーを回避
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      setLoading(false);
      // ポップアップがブロックされた場合はリダイレクトを試す
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/unauthorized-domain') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error('Redirect sign in error:', redirectError);
          throw redirectError;
        }
      } else {
        console.error('Google sign in error:', error);
        throw error;
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await createOrUpdateUserDocument(result.user);
      // ログイン成功後にダッシュボードへリダイレクト
      router.push('/dashboard');
    } catch (error) {
      console.error('Email sign in error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      await createOrUpdateUserDocument(result.user);
      // サインアップ成功後にダッシュボードへリダイレクト
      router.push('/dashboard');
    } catch (error) {
      console.error('Email sign up error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      Cookies.remove('auth-token');
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};