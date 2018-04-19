--------------------------------------------------------
--  File created - ÐÇÆÚÈý-°ËÔÂ-13-2014   
--------------------------------------------------------
--------------------------------------------------------
--  DDL for Table BP_DEF_ONLINE
--------------------------------------------------------

  CREATE TABLE "WSBPM"."BP_DEF_ONLINE" 
   (	"ID" VARCHAR2(20 BYTE), 
	"CODE" VARCHAR2(20 BYTE), 
	"NAME" VARCHAR2(100 BYTE), 
	"CREATOR" VARCHAR2(100 BYTE), 
	"CREATE_TIME" DATE, 
	"LAST_MODIFIED" DATE, 
	"PUBLISH_TIME" VARCHAR2(20 BYTE), 
	"DEFINITION" CLOB
   ) SEGMENT CREATION DEFERRED 
  PCTFREE 10 PCTUSED 40 INITRANS 1 MAXTRANS 255 NOCOMPRESS LOGGING
  TABLESPACE "USERS" 
 LOB ("DEFINITION") STORE AS BASICFILE (
  TABLESPACE "USERS" ENABLE STORAGE IN ROW CHUNK 8192 RETENTION 
  NOCACHE LOGGING ) ;
--------------------------------------------------------
--  Constraints for Table BP_DEF_ONLINE
--------------------------------------------------------

  ALTER TABLE "WSBPM"."BP_DEF_ONLINE" MODIFY ("ID" NOT NULL ENABLE);
