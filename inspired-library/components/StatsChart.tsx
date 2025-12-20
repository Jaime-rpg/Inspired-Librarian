import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Book, Difficulty } from '../types';

interface StatsChartProps {
  books: Book[];
}

const COLORS = ['#86efac', '#fde047', '#fca5a5'];

const StatsChart: React.FC<StatsChartProps> = ({ books }) => {
  const data = [
    { name: Difficulty.Beginner, value: books.filter(b => b.difficulty === Difficulty.Beginner).length },
    { name: Difficulty.Intermediate, value: books.filter(b => b.difficulty === Difficulty.Intermediate).length },
    { name: Difficulty.Advanced, value: books.filter(b => b.difficulty === Difficulty.Advanced).length },
  ].filter(d => d.value > 0);

  return (
    <div className="h-64 w-full bg-white rounded-lg shadow-sm p-4 border border-slate-100 print:hidden">
      <h3 className="text-center font-bold text-slate-700 mb-2 font-fredoka uppercase text-xs tracking-widest">Difficulty Spread</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: '900' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            formatter={(value) => <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;