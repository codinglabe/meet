import MeetingApp from '@/components/MeetingApp';

export default async function RoomPage({ params }) {
  const { roomId } = await params;
  return <MeetingApp initialRoom={roomId} autoRoom />;
}
