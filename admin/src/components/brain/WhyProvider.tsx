import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { WhyTopicId } from '../../lib/why-topics';
import { WhyPanel } from './WhyPanel';

type WhyContextValue = {
  topic: WhyTopicId | null;
  open: (id: WhyTopicId) => void;
  close: () => void;
};

const WhyContext = createContext<WhyContextValue | null>(null);

export function useWhy(): WhyContextValue {
  const ctx = useContext(WhyContext);
  if (!ctx) {
    throw new Error('useWhy must be used within WhyProvider');
  }
  return ctx;
}

/** Brain 表层全局 Why? 面板状态（layout 级单例）。 */
export function WhyProvider({ children }: { children: React.ReactNode }) {
  const [topic, setTopic] = useState<WhyTopicId | null>(null);

  const open = useCallback((id: WhyTopicId) => setTopic(id), []);
  const close = useCallback(() => setTopic(null), []);

  const value = useMemo(() => ({ topic, open, close }), [topic, open, close]);

  return (
    <WhyContext.Provider value={value}>
      {children}
      <WhyPanel topic={topic} onClose={close} />
    </WhyContext.Provider>
  );
}
