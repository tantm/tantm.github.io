/*
khoa(makhoa,tenkhoa)
bomon(mabm, tenbm, makhoa)
giangvien(magv, hoten, phai, tuoi, mabm)
monhoc(mamh, tenmh, mabm)
day(magv, mamh)
*/

create table khoa
  (makhoa number primary key,
   tenkhoa varchar2(30) not null);

create table bomon
  (mabm number primary key,
   tenbm varchar2(30) not null,
   makhoa number not null references khoa(makhoa));

create table giangvien
  (magv number primary key,
   hoten varchar2(30) not null,
   phai varchar2(3) check(phai in ('nam', 'nu')),
   tuoi number,
   mabm number not null references bomon(mabm));

create table monhoc
  (mamh number primary key,
   tenmh varchar2(30) not null,
   mabm number not null references bomon(mabm));

create table day
  (magv number references giangvien(magv),
   mamh number references monhoc(mamh),
   constraint pk_day primary key(magv, mamh));

-- du lieu cua khoa(makhoa, tenkhoa)

insert into khoa(makhoa, tenkhoa)
values(1, 'dien tu');
insert into khoa(makhoa, tenkhoa)
values(2, 'cong nghe thong tin');

-- du lieu cua bo mon(mabm, tenbm, makhoa)

insert into bomon(mabm, tenbm, makhoa)
values(1, 'khoa hoc may tinh', 2);
insert into bomon(mabm, tenbm, makhoa)
values(2, 'ky thuat may tinh', 2);
insert into bomon(mabm, tenbm, makhoa)
values(3, 'he thong thong tin', 2);
insert into bomon(mabm, tenbm, makhoa)
values(4, 'cong nghe phan mem', 2);
insert into bomon(mabm, tenbm, makhoa)
values(5, 'he thong va mang may tinh', 2);
insert into bomon(mabm, tenbm, makhoa)
values(6, 'vien thong', 1);
insert into bomon(mabm, tenbm, makhoa)
values(7, 'he thong dien', 1);
insert into bomon(mabm, tenbm, makhoa)
values(8, 'thiet bi dien', 1);
insert into bomon(mabm, tenbm, makhoa)
values(9, 'tu dong', 1);
insert into bomon(mabm, tenbm, makhoa)
values(10, 'dien tu', 1);

-- du lieu cua giangvien(magv, hoten, phai, tuoi, mabm)

insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(1, 'quan thanh tho', 'nam', 25, 1);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(2, 'nguyen van binh', 'nam', 40, 2);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(3, 'nguyen cao tri', 'nam', 30, 4);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(4, 'le thanh van', 'nu', 25, 5);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(5, 'nguyen trung truc', 'nam', 50, 3);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(6, 'le ngoc minh', 'nam', 57, 5);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(7, 'vo thi ngoc chau', 'nu', 27, 3);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(8, 'nguyen van thuong', 'nam', 48, 7);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(9, 'tran thi yen', 'nu', 36, 9);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(10, 'nguyen thanh nam', 'nam', 39, 9);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(11, 'phan thi hong', 'nu', 25, 8);
insert into giangvien(magv, hoten, phai, tuoi, mabm)
values(12, 'huynh ngoc nu', 'nu', 27, 8);

-- du lieu cua monhoc(mamh, tenmh, mabm)

insert into monhoc(mamh, tenmh, mabm)
values(1, 'he co so du lieu', 3);
insert into monhoc(mamh, tenmh, mabm)
values(2, 'co so du lieu phan tan', 3);
insert into monhoc(mamh, tenmh, mabm)
values(3, 'phan tich va thiet ke he thong', 3);
insert into monhoc(mamh, tenmh, mabm)
values(4, 'cau truc du lieu va giai thuat', 1);
insert into monhoc(mamh, tenmh, mabm)
values(5, 'ngon ngu lap trinh', 1);
insert into monhoc(mamh, tenmh, mabm)
values(6, 'trinh bien dich', 1);
insert into monhoc(mamh, tenmh, mabm)
values(7, 'mang may tinh', 5);
insert into monhoc(mamh, tenmh, mabm)
values(8, 'he dieu hanh', 3);
insert into monhoc(mamh, tenmh, mabm)
values(9, 'cong nghe phan mem', 4);
insert into monhoc(mamh, tenmh, mabm)
values(10, 'kiem thu phan mem', 4);
insert into monhoc(mamh, tenmh, mabm)
values(11, 'thiet ke luan ly', 2);
insert into monhoc(mamh, tenmh, mabm)
values(12, 'cau truc may tinh', 2);

