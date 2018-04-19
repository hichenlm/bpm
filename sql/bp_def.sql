--------------------------------------------------------
--  File created - ÐÇÆÚÈý-°ËÔÂ-13-2014   
--------------------------------------------------------
--------------------------------------------------------
--  DDL for Table BP_DEF
--------------------------------------------------------

  CREATE TABLE "WSBPM"."BP_DEF" 
   (	"ID" VARCHAR2(20 BYTE), 
	"CODE" VARCHAR2(20 BYTE), 
	"NAME" VARCHAR2(100 BYTE), 
	"CREATOR" VARCHAR2(100 BYTE), 
	"CREATE_TIME" DATE, 
	"LAST_MODIFIED" DATE, 
	"DEFINITION" CLOB
   ) SEGMENT CREATION DEFERRED 
  PCTFREE 10 PCTUSED 40 INITRANS 1 MAXTRANS 255 NOCOMPRESS LOGGING
  TABLESPACE "USERS" 
 LOB ("DEFINITION") STORE AS BASICFILE (
  TABLESPACE "USERS" ENABLE STORAGE IN ROW CHUNK 8192 RETENTION 
  NOCACHE LOGGING ) ;
--------------------------------------------------------
--  DDL for Index BP_DEF_PK
--------------------------------------------------------

  CREATE UNIQUE INDEX "WSBPM"."BP_DEF_PK" ON "WSBPM"."BP_DEF" ("ID") 
  PCTFREE 10 INITRANS 2 MAXTRANS 255 NOCOMPRESS LOGGING
  TABLESPACE "USERS" ;
--------------------------------------------------------
--  Constraints for Table BP_DEF
--------------------------------------------------------

  ALTER TABLE "WSBPM"."BP_DEF" ADD CONSTRAINT "BP_DEF_PK" PRIMARY KEY ("ID")
  USING INDEX PCTFREE 10 INITRANS 2 MAXTRANS 255 NOCOMPRESS LOGGING
  TABLESPACE "USERS"  ENABLE;
 
  ALTER TABLE "WSBPM"."BP_DEF" MODIFY ("ID" NOT NULL ENABLE);
