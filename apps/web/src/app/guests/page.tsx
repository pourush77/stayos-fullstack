import { redirect } from 'next/navigation';

export default function GuestsIndexPage() {
  redirect('/reservations');
}
