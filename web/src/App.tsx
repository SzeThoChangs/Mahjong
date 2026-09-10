import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Train from '@/components/Train';
import Tips from '@/components/Tips';
import Review from '@/components/Review';
import Replay from '@/components/Replay';
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
            {/* one practice tab: pack positions marked by play-outs, with a made-up hand only as
                a labelled fallback. The coach-marked tab that used to sit beside it is folded in. */}
            <TabsTrigger value="train">Train</TabsTrigger>
            <TabsTrigger value="spot">Spot</TabsTrigger>
            <TabsTrigger value="ask">Your hand</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="film">Film room</TabsTrigger>
            <TabsTrigger value="table">Table setup</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === 'train' ? <Train /> : tab === 'spot' ? <Spot /> : tab === 'ask' ? <AskHand /> : tab === 'tips' ? <Tips /> : tab === 'review' ? <Review onPractise={() => setTab('train')} /> : tab === 'table' ? <TableSetup /> : <Replay />}
    </div>
  );
}
