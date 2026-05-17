create or replace function match_papers(
  query_embedding vector(768),
  match_count int default 10,
  match_threshold float default 0.1
)
returns table (
  id int,
  pmid bigint,
  title text,
  abstract text,
  journal text,
  year int,
  doi text,
  similarity float
)
language sql stable
as $$
  select
    p.id,
    p.pmid,
    p.title,
    p.abstract,
    p.journal,
    p.year,
    p.doi,
    1 - (p.embedding <=> query_embedding) as similarity
  from papers p
  where p.embedding is not null
    and 1 - (p.embedding <=> query_embedding) > match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
