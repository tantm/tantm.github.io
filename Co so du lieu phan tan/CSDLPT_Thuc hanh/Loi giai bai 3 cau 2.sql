stepwise refinement: kỹ thuật tinh chế dòng

select mabm into $mabm
from gvcntt
where magv=$magv;
if #found
{
	select mamh,tenmh
	from mhcntt
	where mamh in (select mamh
				   from daycntt
				   where magv=$magv)
	      and mabm != $mabm
	union all
	select mamh,tenmh
	from mhmnon
	where mamh in (select mamh
				   from daymnon
				   where magv=$magv)	
}
else
{
	select mabm into $mabm
	from gvmnon
	where magv=$magv;
	if #found
	{
		select mamh,tenmh
		from mhmnon
		where mamh in (select mamh
					   from daymnon
					   where magv=$magv)
		      and mabm != $mabm
		union all
		select mamh,tenmh
		from mhcntt
		where mamh in (select mamh
					   from daycntt
					   where magv=$magv)	
	}
}


