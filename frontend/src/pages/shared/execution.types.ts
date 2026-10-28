export type Member = {
  assignment_id: string;
  creator_id: string;
  display_name: string;
  work_scope: string;
  deadline: string | null;
  status: string;
};
export type Delay = {
  reported_by_name: string;
  decided_by_name: string | null;
  responsible_creator_name: string | null;
  id: string;
  description: string;
  status: string;
  proposed_responsibility: string;
  proposed_deadline: string | null;
  responsibility: string | null;
  previous_deadline: string | null;
  new_deadline: string | null;
  decision_note: string | null;
  responsible_creator_id: string | null;
};
