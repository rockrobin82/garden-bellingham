-- Read-only. Run this file alone only when 02 shows day_sold_count_sync as non-null.
-- If that cell is null, skip this file and record that the table is absent.
-- Returns status and a count. It does not return detail text.

select status, count(*) as rows
from public.day_sold_count_sync
group by status
order by status;
