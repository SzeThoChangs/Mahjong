import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Trainer from '@/components/Trainer';
import Replay from '@/components/Replay';
import RealQuiz from '@/components/RealQuiz';

export default function App() {
  const [tab, setTab] = useState('train');
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="train">Train</TabsTrigger>
            <TabsTrigger value="real">Real quiz</TabsTrigger>
            <TabsTrigger value="film">Film room</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === 'train' ? <Trainer /> : tab === 'real' ? <RealQuiz /> : <Replay />}
    </div>
  );
}
