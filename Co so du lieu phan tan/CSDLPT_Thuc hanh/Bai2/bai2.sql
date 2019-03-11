/*
Bai 2: 
bomon(mabm,tenbm,tenkhoa)
giangvien(magv,hoten,phai,tuoi,diachi,mabm)
monhoc(mamh,tenmh,mabm,sotiet)
dean(mada,tenda,magv,ketqua)
day(magv,mamh)
*/
drop database BAI2_CSDLPT;
create database BAI2_CSDLPT
use BAI2_CSDLPT
GO

drop table day;
drop table monhoc;
drop table dean;
drop table giangvien;
drop table bomon; 

create table bomon
(
	mabm int identity(1,1) primary key,
	tenbm nvarchar(100), 
	tenkh nvarchar(100)
)
create table giangvien
(
	magv int identity(1,1) primary key, 
	hoten nvarchar(100), 
	phai nvarchar(100),
	tuoi int, 
	diachi nvarchar(200),
	mabm int
)
create table monhoc
(
	mamh int identity(1,1) primary key,
	tenmh nvarchar(100), 
	mabm int, 
	sotiet int
)
create table dean
(
	mada int identity(1,1) primary key, 
	tenda nvarchar(100), 
	magv int, 
	ketqua nvarchar(10)
)
create table day
(
	magv int not null,
	mamh int not null
)
alter table giangvien add 
constraint fk_giangvien_mabm foreign key (mabm) references bomon(mabm)

alter table monhoc add 
constraint fk_monhoc_mabm foreign key (mabm) references bomon(mabm)

alter table dean add 
constraint fk_dean_magv foreign key (magv) references giangvien(magv)

alter table day add
constraint fk_day_magv foreign key (magv) references giangvien(magv)

alter table day add
constraint fk_day_mamh foreign key (mamh) references monhoc(mamh)

delete from day;
delete from monhoc;
delete from dean;
delete from giangvien;
delete from bomon;

insert into bomon(tenbm,tenkh)
values (N'Khoa học máy tính',N'Công nghệ thông tin'); 
insert into bomon(tenbm,tenkh)
values (N'Kỹ thuật phần mềm',N'Công nghệ thông tin'); 
insert into bomon(tenbm,tenkh)
values (N'Hệ thống thông tin',N'Công nghệ thông tin'); 
insert into bomon(tenbm,tenkh)
values (N'Kỹ thuật máy tính',N'Công nghệ thông tin'); 

insert into giangvien(hoten,phai,tuoi,diachi,mabm) 
values (N'Nguyễn Trãi',N'Nam',40,N'số 4, Nguyễn Trãi, quận 5, tp Hồ Chí Minh',1);
insert into giangvien(hoten,phai,tuoi,diachi,mabm) 
values (N'',N'',,N'',);

insert into dean

insert into monhoc

insert into day


