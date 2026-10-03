begin;

-- Reuse the private Admin intake queue. Historical sources and files are preserved.
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
 check(source in ('CONTACT','PROJECT_REQUEST','BUSINESS_CONTACT','CREATOR_APPLICATION'));
alter table public.leads
 add column applicant_type text check(applicant_type in ('CREATOR','STUDENT')),
 add column specialty text not null default '' check(length(specialty)<=200),
 add column portfolio_urls text[] not null default '{}';
create function public.valid_intake_portfolio_urls(urls text[]) returns boolean
language sql immutable set search_path=public as $$
 select not exists(select 1 from unnest(urls) as item(url)
  where url is null or length(url)>2000
  or url !~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
$$;
alter table public.leads add constraint leads_portfolio_urls_check
 check(cardinality(portfolio_urls)<=5 and public.valid_intake_portfolio_urls(portfolio_urls));
alter table public.leads add constraint leads_creator_application_check check(
 source<>'CREATOR_APPLICATION' or (
  applicant_type is not null and length(trim(specialty))>=2
  and cardinality(portfolio_urls)>=1
  and attachment_path is not null and attachment_path like id::text||'/%' and attachment_path like '%.pdf'
  and attachment_name is not null and lower(attachment_name) like '%.pdf'
  and attachment_size is not null and attachment_size between 1 and 10485760
  and customer_id is null and project_id is null and status<>'CONVERTED'
  and service_id is null
 )
);
alter table public.leads add constraint leads_application_fields_check check(
 source='CREATOR_APPLICATION' or (applicant_type is null and specialty='' and cardinality(portfolio_urls)=0)
);
alter table public.leads add constraint leads_business_company_check
 check(source<>'BUSINESS_CONTACT' or length(trim(company))>=1);
create index leads_source_created_idx on public.leads(source,created_at desc,id);

-- Browser clients retain the existing Admin-only RLS. Anonymous forms use the API.
revoke all on public.leads from anon;

-- Notify inside the system; this does not send email or provision Auth accounts.
create or replace function public.notify_new_lead() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into notifications(user_id,title,message,type)
 select id,
  case new.source when 'CREATOR_APPLICATION' then 'Hồ sơ ứng tuyển Creator'
   when 'BUSINESS_CONTACT' then 'Liên hệ doanh nghiệp'
   else 'Liên hệ mới' end,
  new.full_name || case when new.company<>'' then ' — '||new.company else '' end,
  'NEW_LEAD'
 from profiles where role='ADMIN' and active;
 return new;
end $$;

commit;
