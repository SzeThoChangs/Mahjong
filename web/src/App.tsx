import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Trainer from '@/components/Trainer';
import Tips from '@/components/Tips';
import Review from '@/components/Review';
import Replay from '@/components/Replay';
import RealQuiz from '@/components/RealQuiz';
import TableSetup from '@/components/TableSetup';
import AskHand from '@/components/AskHand';
import Spot from '@/components/Spot';

export default function App() {
  const [tab, setTab] = useState('train');
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* The tabs are wider than a narrow phone. They scroll inside their own strip rather than
          dragging the whole page sideways with them, which is what happened when the tips tab was added. */}
      <div className="mx-auto max-w-5xl overflow-x-auto px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-max">
            <TabsTrigger value="train">Train</TabsTrigger>
            <TabsTrigger value="spot">Spot</TabsTrigger>
            <TabsTrigger value="real">Real quiz</TabsTrigger>
            <TabsTrigger value="ask">Your hand</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="film">Film room</TabsTrigger>
            <TabsTrigger value="table">Table setup</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === 'train' ? <Trainer /> : tab === 'spot' ? <Spot /> : tab === 'real' ? <RealQuiz /> : tab === 'ask' ? <AskHand /> : tab === 'tips' ? <Tips /> : tab === 'review' ? <Review /> : tab === 'table' ? <TableSetup /> : <Replay />}
    </div>
  );
}
