'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from './components/Header/Header';
import LandingView from './components/LandingView/LandingView';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Header onNavigate={(page) => page === 'markets' ? router.push('/markets') : null} currentPage="landing" />
      <div className={styles.mainContainer}>
        <div className={styles.scrollContent} style={{ width: '100%', paddingTop: '24px' }}>
          <LandingView />
        </div>
      </div>
    </>
  );
}
