import type { CreatorTeamSnapshot } from "../types/commerce";
export function CreatorRoster({team}: {team?:CreatorTeamSnapshot[]}) {
 if(!team?.length)return null;
 return <section className="contract-roster"><h3>Đội và phần việc đã thống nhất</h3><ul>{team.map(member=><li key={member.creator.id}><strong>{member.creator.display_name}</strong><p>{member.work_scope || member.creator.title}</p>{member.deadline && <small>Hạn bàn giao: {new Date(member.deadline).toLocaleDateString('vi-VN')}</small>}</li>)}</ul></section>;
}
