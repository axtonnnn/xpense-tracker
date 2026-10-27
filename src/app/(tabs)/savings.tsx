import GoalView from '@/components/GoalView';

/** iPad and Mac: the savings goal as a sidebar page. Phones open it as its own screen (src/app/goal). */
export default function SavingsTab() {
  return <GoalView embedded />;
}
