const DateTime = require('date-and-time');
const Validator = require('validator');
const fs = require('fs/promises');
const { constants: fsConstants, createWriteStream } = require('fs');
const path = require('path');
// const { v4: UUIDV4 } = require('uuid');
const { Readable, PassThrough } = require('stream');
const XLSX = require('xlsx');
const Papa = require('papaparse');

let LibPhoneNumberJs;
let LuxonDateTime;
try 
{
    LibPhoneNumberJs = require('libphonenumber-js');
	LuxonDateTime = require('luxon');
} 
catch(error) 
{
    console.warn('[Utils] libphonenumber-js/luxon is not installed. Phone number parsing will be skipped.');
}

const Utils = {

	Constants : {
		SQL_TIME_FORMAT : 'YYYY-MM-DD HH:mm:ss',
		SQL_DATE_FORMAT : 'YYYY-MM-DD',
		SQL_MONTH_FORMAT : 'YYYY-MM',
		WHATSAPP : 'whatsapp'
	},

	getRandomId()
	{
		// return UUIDV4();
	},

	logInfo(message, printCode) {
		const formattedMessage = (typeof message === 'string' ? message : JSON.stringify(message)).trim();
		console.info(`INFO  ::: ${printCode} ::: ${formattedMessage}`);
	},

	logWarn(message, printCode) {
		const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
		console.warn(`WARN  ::: ${printCode} ::: ${formattedMessage}`);
	},

	logDebug(message, printCode) {
		let isDebugEnabled = process.env?.DEBUG === 'true' || process.env?.DEBUG === '1' || false;
		if (!isDebugEnabled) {
			return;
		}

		let formattedMessage;
		if (typeof message === 'string') {
			formattedMessage = message;
		} else {
			try {
				formattedMessage = JSON.stringify(message);
			} catch (error) {
				formattedMessage = `[Object with circular reference: ${message.constructor?.name || 'Unknown'}]`;
			}
		}
		console.debug(`DEBUG ::: ${printCode} ::: ${formattedMessage}`);
	},

	logError(error, printCode) {
		if (error instanceof Error) {
			console.error(`ERROR ::: ${printCode} ::: ${error.message}`);
			if (error.stack) {
				console.error(error.stack);
			}
		} else {
			const formattederror = typeof error === 'string' ? error : JSON.stringify(error);
			console.error(`ERROR ::: ${printCode} ::: ${formattederror}`);
		}
	},

	getUpdateSuccessResponse(message)
	{
		let response = {};
		response.status = "success";
		response.code = "SUCCESS";
		if(message == null)
		{
			message = "Updated successfully.";
		}
		response.message = message;
		return response;
	},

	getDeleteSuccessResponse(message)
	{
		let response = {};
		response.status = "success";
		response.code = "SUCCESS";
		if(message == null)
		{
			message = "Deleted successfully.";
		}
		response.message = message;
		return response;
	},

	getRecordsForResponse(module, records, hasMore)
	{
		var response = {};
		response[module] = records;
		if(hasMore != null)
		{
			response.info = {"has_more" : hasMore};
		}
		return response;
	},

	getInternalError(reason, message)
	{
		if(message == null)
		{
			message = "Internal error.";
		}
		return new Error(message, {cause: {code: "INTERNAL_ERROR", reason: reason}})
	},

	getInternalErrorResponse()
	{
		var response = {};
		response.status = "error";
		response.message = "Internal error.";
		response.code = "INTERNAL_ERROR";
		return response;
	},

	getInvalidUrlErrorResponse()
	{
		var response = {};
		response.status = "error";
		response.message = "Invalid URL.";
		response.code = "INVALID_URL";
		return response;
	},

	getInvalidModuleError()
	{
		return new Error("The given module is invalid.", {cause: {code: "INVALID_MODULE"}});
	},

	getInvalidModuleErrorResponse()
	{
		var response = {};
		response.status = "error";
		response.message = "The given module is invalid.";
		response.code = "INVALID_MODULE";
		return response;
	},

	getInvalidIdError()
	{
		return new Error("The given id is invalid.", {cause: {code: "INVALID_ID"}});
	},

	getInvalidIdErrorResponse(module)
	{
		var response = {};
		response.status = "error";
		response.message = module + " id is invalid.";
		response.code = "INVALID_ID";
		return response;
	},

	getUnauthorizedError()
	{
		return new Error("This user is not permitted to do this operation.", {cause: {code: "UNAUTHORIZED"}})
	},

	getUnauthorizedErrorResponse()
	{
		var response = {};
		response.status = "error";
		response.message = "This user is not permitted to do this operation.";
		response.code = "UNAUTHORIZED";
		return response;
	},

	getInvalidDataError(field, msg)
	{
		if(msg == null)
		{
			msg = "Invalid data.";
		}
		return new Error(msg, {cause: {code: "INVALID_DATA", key: field}});
	},

	getInvalidDataErrorResponse(field, msg)
	{
		return Utils.getErrorForResponse(Utils.getInvalidDataError(field, msg));
	},

	getErrorForResponse(error, includeEntity,entityName)
	{
		var response = {};
		response.status = "error";
		response.message = error.message;
		if(error.code != null)
		{
			response.code = error.code;
		}
		if(error.cause != null)
		{
			response.code = error.cause.code;
			if(error.cause.key)
			{
				response.key = error.cause.key;
			}
			if(error.cause.info)
			{
				response.info = error.cause.info;
			}
			if(error.cause.index !== undefined)
			{
				response.index = error.cause.index;
			}
			response.reason = error.cause.reason;
			if(includeEntity)
			{
				response[entityName || "entity"] = error.cause.entity;
			}
		}
		return response;
	},

	getNowTomorrow()
	{
		return DateTime.format(new Date(Date.now() + (24*60*60*1000)), Utils.Constants.SQL_TIME_FORMAT);
	},

	getCurrentDate()
	{
		return DateTime.format(new Date(Date.now()), Utils.Constants.SQL_DATE_FORMAT);
	},

	formatDateToMonth(millisOrString)
	{
		if(millisOrString != null)
		{
			return DateTime.format(new Date(millisOrString),Utils.Constants.SQL_MONTH_FORMAT);
		}
		else
		{
			return null;
		}
	},

	getNextDay(millisOrString)
	{
		if(millisOrString != null)
		{
			return DateTime.addDays(new Date(millisOrString),1);
		}
		else
		{
			return null;
		}
	},

	getNextMonth(millisOrString)
	{
		if(millisOrString != null)
		{
			return DateTime.addMonths(new Date(millisOrString),1);
		}
		else
		{
			return null;
		}
	},

	formatDate(date, format)
	{
		if(date != null && date instanceof Date && !isNaN(date))
		{
			if(!format)
			{
				format = Utils.Constants.SQL_DATE_FORMAT;
			}
			return DateTime.format(date, format);
		}
		else
		{
			return null;
		}
	},

	getCurrentTimeInMillis()
	{
		return Date.now();
	},

	getCurrentTime()
	{
		return DateTime.format(new Date(), Utils.Constants.SQL_TIME_FORMAT);
	},

	getDateFormat(dateTimeFormat) 
	{
		if(!dateTimeFormat)
		{
			dateTimeFormat = Utils.Constants.SQL_TIME_FORMAT;
		}
		let parts = dateTimeFormat.trim().split(/\s+/);
		return parts[0];
	},

	formatTime(dateOrStringOrMillis, format, utc) 
	{
		if(dateOrStringOrMillis != null) 
		{
			if(!format)
			{
				format = Utils.Constants.SQL_TIME_FORMAT;
			}
			let date = dateOrStringOrMillis instanceof Date ? dateOrStringOrMillis : new Date(dateOrStringOrMillis);
			return DateTime.format(date, format, utc);
		} 
		else 
		{
			return null;
		}
	},

	getTimeZoneTime(utcDate, timeZone) 
	{
		if(utcDate && utcDate instanceof Date && LuxonDateTime && timeZone) 
		{
			let timeZoneDate = LuxonDateTime.DateTime.fromJSDate(utcDate, { zone: "UTC" }).setZone(timeZone);
			return Utils.formatTime(timeZoneDate.toJSDate());
		} 
		else 
		{
			return null;
		}
	},

	getUtcTime(timeZoneDate, timeZone) 
	{
		if(timeZoneDate && timeZoneDate instanceof Date && LuxonDateTime && timeZone) 
		{
			let zonedDate = LuxonDateTime.DateTime.fromJSDate(timeZoneDate, { zone: timeZone }).toUTC();
			return Utils.formatTime(zonedDate.toJSDate(), null, true);
		} 
		else 
		{
			return null;
		}
	},

	getFormattedTime(fbTimestamp)
	{
		if(fbTimestamp != null)
		{
			return DateTime.format(new Date(parseInt(fbTimestamp*1000)), Utils.Constants.SQL_TIME_FORMAT);
		}
		else
		{
			return null;
		}
	},

	getFormattedTimeFromString(dateString) {
		if(dateString)
		{
			return DateTime.format(new Date(dateString), Utils.Constants.SQL_TIME_FORMAT);
		}
		return null;
	},
	
	getCustomFormatDate(millisOrString, dateTimeFormat)
	{
		let formattedDate = null;
		let format = Utils.getDateFormat(dateTimeFormat);
		if(millisOrString)
		{
			formattedDate = Utils.formatDate(new Date(millisOrString), format);
		}
		return formattedDate;
	},

	formatTimeWithTimeZone(millisOrString, dateTimeFormat, timeZone) 
	{
		let formattedTime = null;
		if(millisOrString && timeZone && LuxonDateTime) 
		{
			let timeZonedTime = LuxonDateTime.DateTime.fromFormat(
				millisOrString,
				"yyyy-MM-dd HH:mm:ss",
				{ zone: "UTC" }
			).setZone(timeZone);
			formattedTime = Utils.formatTime(timeZonedTime, dateTimeFormat);
		}
		return formattedTime;
	},

	getMillisDiff(timestampStr1, timestampStr2)
	{
		return Date.parse(timestampStr1) - Date.parse(timestampStr2);
	},

	isPast(timestamp)
	{
		return (Date.parse(timestamp) < Date.now());
	},

	compareTime(newTime, existingTime)
	{
		const changedExistingTime = Date.parse(existingTime) - (60 * 60 * 1000);
		return (Date.parse(newTime) < changedExistingTime);
	},

	getReminderTimeFromString(reminderStr, expirationTime)
	{
		let totalMinutes = 0;
		if (typeof reminderStr === "string") {
			const reminderParts = reminderStr.split(",");
			reminderParts.forEach(part => {
				const [unit, value] = part.split("_");
				if (unit === "hours")
				{
					totalMinutes += parseInt(value, 10) * 60;
				}
				else if (unit === "minutes")
				{
					totalMinutes += parseInt(value, 10);
				}
			});
		}
		const expiration = new Date(expirationTime);
		return new Date(expiration.getTime() - totalMinutes * 60000);
	},

	isPastMillis(millis)
	{
		return (millis < Date.now());
	},

	getAsCommaSeparatedString(list, key)
	{
		let string = "";
		if(list != null)
		{
			list.forEach((element) => {
				let entry = element;
				if(key != null)
				{
					entry = element[key];
				}
				string += "'" + entry + "',";
			});
			string = string.substring(0, string.length-1);
		}
		return string;
	},

	getAsList(objectList, key)
	{
		let list = [];
		if(objectList != null)
		{
			objectList.forEach((element) => {
				let entry = element;
				if(key != null)
				{
					entry = element[key];
				}
				list.push(entry);
			});
		}
		return list;
	},
    
    convertToRow(apiObject)
	{
		let newRow = {};
		for (const [key, value] of Object.entries(apiObject)) 
		{
			newRow[key.toUpperCase()] = value;
		}
		return newRow;
	},

	convertToApiObject(row)
	{
		let newApiObj = {};
		for (const [key, value] of Object.entries(row)) 
		{
			if("ROWID" == key)
			{
				newApiObj.id = value;
			}
			else if("CREATORID" == key)
			{
				newApiObj.created_by = value;
			}
			else if("CREATEDTIME" == key)
			{
				newApiObj.created_time = value;
			}
			else if("MODIFIEDTIME" == key)
			{
				newApiObj.modified_time = value;
			}
			else
			{
				newApiObj[key.toLowerCase()] = value;
			}
		}
		return newApiObj;
	},

	mergeFieldValues(value, fieldType, record, systemProperties, business)
    {
        let originalFieldType = fieldType;
        if(originalFieldType == "object")
        {
            value = JSON.stringify(value);
            fieldType = "string";
        }
        let finalValue = value;
        if(value != null && typeof value === "string" && value.includes("{{"))
        {
            value.match(/{{[a-zA-Z0-9._]+}}/g).forEach((mergeField) => {
                let fieldName = Utils.getMergedFieldName(mergeField);
                let mergeValue = record[fieldName];
                if(fieldName.startsWith("__"))
                {
                    mergeValue = systemProperties[fieldName];
                }
                else if(fieldName.includes("."))
                {
                    let lookupFieldSplit = fieldName.split('.');
                    let lookupRecord = record[lookupFieldSplit[0]];
                    if(lookupRecord != null)
                    {
                        mergeValue = lookupRecord[lookupFieldSplit[1]];
                    }
                }
                if((Utils.isValidDate(mergeValue) || Utils.isValidDateTime(mergeValue)) && business != null)
                {
                    if(Utils.isValidDate(mergeValue)) 
                    {
                        mergeValue = Utils.getCustomFormatDate(mergeValue, business.date_time_format);
                    }
                    else if(Utils.isValidDateTime(mergeValue))
                    {
                        mergeValue = Utils.formatTimeWithTimeZone(mergeValue, business.date_time_format, business.time_zone);
                    }
                    finalValue = finalValue.replace(mergeField, mergeValue);
                }
                else if(["string", "text"].includes(fieldType))
                {
                    finalValue = finalValue.replace(mergeField, mergeValue);
                }
                else 
                {
                    finalValue = mergeValue;
                }
            });
        }
        if(originalFieldType == "object")
        {
            return JSON.parse(finalValue);
        }
        else
        {
            return finalValue;
        }
    },

	mergeObjects(obj1, obj2)
	{
		Object.entries(obj2).forEach(([key, value]) => {
			if(value !== undefined)
			{
				obj1[key] = value;
			}
		});
		return obj1;
	},

	replaceMergeFieldsInObject(object, values)
	{
		if(!object || !values)
		{
			return object;
		}
		else
		{
			return JSON.parse(Utils.replaceMergeFields(JSON.stringify(object), values));
		}
	},

	replaceMergeFields(text, values)
	{
		if(!text || !values)
        {
            return text;
        }
		else
        {
            return text.replace(/{{([^}]+)}}/g, (match, key) => {
                return values[key] !== undefined ? values[key] : match;
            });
        }
	},

	isCompleteObject(obj)
	{
		if(!Utils.isValidObject(obj) || Object.keys(obj).length === 0)
		{
			return false;
		}
		else
		{
			return Object.values(obj).every((value) => {
				if(value === null || value === undefined)
				{
					return false;
				}
				else if(typeof value === 'string' && value.trim() === '')
				{
					return false;
				}
				else if(Array.isArray(value) && value.length === 0)
				{
					return false;
				}
				else if(Utils.isValidObject(value) && Object.keys(value).length === 0)
				{
					return false;
				}
				else
				{
					return true;
				}
			});
		}
	},

	areEqualObjects(obj1, obj2)
	{
		if(!Utils.isValidObject(obj1) || !Utils.isValidObject(obj2))
		{
			return false;
		}
		else
		{
			return JSON.stringify(obj1) === JSON.stringify(obj2);
		}
	},

	constructEmptyObject(keys)
	{
		if(!Utils.isValidArray(keys))
		{
			return {};
		}
		else
		{
			return keys.reduce((obj, key) => {
				obj[key] = null;
				return obj;
			}, {});
		}
	},

	getAsSnakeCase(text)
	{
		if (!Utils.isValidString(text))
		{
			return null;
		}
		else
		{
			return text.toLowerCase().replace(/\s+/g, '_');
		}
	},

	getKeysPresent(object)
	{
		let keys = [];
		Object.entries(object).forEach(([key, value]) => {
			if(value !== undefined)
			{
				keys.push(key);
			}
		});
		return keys;
	},

	isValidString(value)
	{
		return typeof value == 'string';
	},

	isValidInt(value)
	{
		return typeof value == 'number' || (typeof value == 'string' && Validator.isInt(value));
	},

	isValidMobile(value, verifyCountryCode)
	{
		return value != null && typeof value == "string" && Validator.isMobilePhone(value) && (!verifyCountryCode || !LibPhoneNumberJs || LibPhoneNumberJs.isValidPhoneNumber(value));
	},

	normalizeMobileNumber(mobile) {
		if (!mobile || typeof mobile !== 'string') {
			return mobile;
		}

		const cleanMobile = (mobile).toString().trim();

		// If it already starts with +, return as is
		if (cleanMobile.startsWith('+')) {
			return cleanMobile;
		}

		// If it starts with digits and looks like an international number, add +
		if (/^[1-9]\d{10,14}$/.test(cleanMobile)) {
			return '+' + cleanMobile;
		}

		// Return original if it doesn't match expected patterns
		return cleanMobile;
	},
	
	isValidUrl(value)
	{
		return (value != null && typeof value == "string" && Validator.isURL(value));
	},

	isValidEmail(value)
	{
		return (value != null && typeof value == "string" && Validator.isEmail(value));
	},

	isValidArray(value)
	{
		return (value != null && typeof value == "object" && Array.isArray(value));
	},

	isValidObject(value)
	{
		return (value != null && typeof value == "object" && !Array.isArray(value));
	},

	isEmptyObject(obj)
	{
		if (obj === null || obj === undefined) {
		  return true;
		}
		return Object.keys(obj).length === 0;
	},

	isValidDate(value)
	{
		return value !== null && Utils.isValidString(value) && !isNaN(Date.parse(value)) && Validator.isDate(value,{format:Utils.Constants.SQL_DATE_FORMAT, strictMode:true});
	},

	isValidDateTime(value)
	{
		if(value != null && Utils.isValidString(value) && Validator.isISO8601(value, {strict: true}))
		{
			let time = value.split(' ')[1];
			if(time != null && /^(\d{2}:){2}\d{2}$/g.test(time))
			{
				return true;
			}
			else
			{
				return false;
			}
		}
		else
		{
			return false;
		}
	},

	isNumeric(value){
		return !isNaN(parseFloat(value)) && isFinite(value);
	},

	isValidMedia(value)
	{
		let valid = false;
		if(Utils.isValidObject(value))
		{
			let { csid, fsid, stratus_file_id, mime_type, name, size } = value;
			let fileId = csid || stratus_file_id || fsid;
			if(fileId && mime_type && name)
			{
				valid = true;
			}
		}
		return valid;
	},
	
	getAsBoolean(value)
	{
		return Validator.toBoolean(value);
	},

	deleteTempFile(path) {
		if (path) {
			fs.unlink(path)
			.then(_ => _)
			.catch((error) => {
				Utils.logError(error, "delete_temp_file");
			})
		}
	},

	//removes the {{ & }} at the start and end
	getMergedFieldName(mergeField)
	{
		return mergeField.slice(2, mergeField.length-2);
	},

	/**
	 * @description replaces the template variables in the query with the values from args
	 */
	replaceTemplateVariables(query, args) {
		if (args != null && query != null) {
			for (const [key, value] of Object.entries(args)) {
				query = query.replace("{{" + key + "}}", value);
			}
			return query;
		}
		else {
			return null;
		}
	},

	stringToBoolean(value) {
		if (value === "" || value === null || value === undefined) {
			return undefined;
		}
		if (typeof value === 'boolean') {
			return value;
		}
		if (value === "true") {
			return true;
		}
		if (value === "false") {
			return false;
		}
		return undefined
	},

	getNestedValue : (obj, path) => {
		return path.split(".").reduce((acc, key) => acc?.[key], obj);
	},

	createTempFileFromStream(stream) 
	{
		const filePath = path.join('/tmp', `${Utils.getRandomId()}.tmp`);
		const writeStream = createWriteStream(filePath);
		return new Promise((resolve, reject) => {
			stream.pipe(writeStream)
			.on('finish', () => resolve(filePath))
			.on('error', (err) => reject(err));
		});
	},

	async createJsonFileForUpload(data, prefix = "campaign_members") {
		try {
			const jsonString = JSON.stringify(data, null, 2);
			const fileName = `${prefix}_${Date.now()}.json`;
			const buffer = Buffer.from(jsonString, "utf8");
			const stream = this.getStreamFromBuffer(buffer);
			const filePath = await this.createTempFileFromStream(stream);
			
			return {
				originalname: fileName,
				mimetype: "application/json",
				buffer,
				size: buffer.length,
				path: filePath,
			};
		} catch (error) {
			throw new Error(`Failed to create JSON file: ${error.message}`);
		}
	},

	async createFailedMembersFileForUpload(data, format = "csv", prefix = "failed_members") {
		try {
			let fileName, buffer, mimetype;

			if(!["csv", "excel"].includes(format))
			{
				throw new Error(`Unsupported format: ${format}. Supported formats: csv, excel`);
			}

			if (format === "csv") {
				const csv = Papa.unparse(data);
				buffer = Buffer.from(csv, 'utf-8');
				fileName = `${prefix}_${Date.now()}.csv`;
				mimetype = 'text/csv';
			} else if (format === "excel") {
				buffer = this.generateExcel(data);
				fileName = `${prefix}_${Date.now()}.xlsx`;
				mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
			} else {
				throw new Error(`Unsupported format: ${format}. Supported formats: csv, excel`);
			}

			if (!buffer || !Buffer.isBuffer(buffer)) {
				throw new Error('Failed to create file buffer');
			}

			const stream = this.getStreamFromBuffer(buffer);
			const filePath = await this.createTempFileFromStream(stream);

			return {
				originalname: fileName,
				mimetype: mimetype,
				buffer: buffer,
				size: buffer.length,
				path: filePath,
			};
		} catch (error) {
			throw new Error(`Failed to create ${format.toUpperCase()} file: ${error.message}`);
		}
	},

	generateExcel(data) {
		if (!data || data.length === 0) {
			throw new Error("No data to export");
		}

		try {
			const worksheet = XLSX.utils.json_to_sheet(data);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Failed Members");

			const excelBuffer = XLSX.write(workbook, {
				type: 'buffer',
				bookType: 'xlsx'
			});

			return Buffer.from(excelBuffer);
		} catch (error) {
			console.error("Excel generation failed:", error);
			throw new Error(`Could not generate Excel file: ${error.message}`);
		}
	},

	async renameTempFile(tempFilePath, newName, originalClientFileName) {
		if (!tempFilePath || typeof tempFilePath !== 'string') {
			throw new Error('Invalid tempFilePath provided. Must be a non-empty string.');
		}
		if (!newName || typeof newName !== 'string' || String(newName).trim() === '') {
			throw new Error('Invalid newName provided. Must be a non-empty string or number.');
		}
		if (!originalClientFileName || typeof originalClientFileName !== 'string' || originalClientFileName.trim() === '') {
			throw new Error('Invalid originalClientFileName provided. Must be a non-empty string.');
		}

		try {
			await fs.access(tempFilePath, fsConstants.F_OK);
		} catch (err) {
			if (err.code === 'ENOENT') {
				throw new Error(`Temporary source file not found: ${tempFilePath}`);
			}
			throw new Error(`Error accessing temporary source file '${tempFilePath}': ${err.message}`);
		}
		const originalExtension = path.extname(originalClientFileName);

		const newFileName = String(newName) + originalExtension;
		const tempFileDir = path.dirname(tempFilePath);
		const newTempFilePath = path.join(tempFileDir, newFileName);

		try {
			await fs.rename(tempFilePath, newTempFilePath);
			return { newTempFilePath, newFileName };
		} catch (err) {
			throw new Error(`Failed to rename temporary file from '${tempFilePath}' to '${newTempFilePath}': ${err.message}`);
		}
	},

	async getFileMeta(url) 
	{
		try 
		{
			const response = await fetch(url, { method: "HEAD" });
			const mime_type = response.headers.get("content-type");
			if(!response.ok || !mime_type || mime_type.includes("text/html")) 
			{
				throw new Error("Unsupported media url.", { cause: { code: "INVALID_URL" } });
			}
			const size = response.headers.get("content-length");
			const disposition = response.headers.get("content-disposition");
			let name = null;
			if(disposition && disposition.includes("filename=")) 
			{
				name = disposition.split("filename=")[1].replace(/['"]/g, "");
			} 
			else 
			{
				name = url.split("/").pop().split("?")[0] || "file";
			}

			return {
				name,
				size: size ? Number(size) : null,
				mime_type
			};
		} 
		catch(error)
		{
			throw new Error("Unsupported media url.", { cause: { code: "INVALID_URL" } });
		}
	},

	getStreamFromBuffer(buffer)
	{
		const stream = new PassThrough();
		stream.end(buffer);
		return stream;
	},
	
	async downloadFileFromUrl(url, meta) 
	{
		try 
		{
			const response = await fetch(url);
			if(!response.ok) 
			{
				throw Utils.getInternalError("Failed to download file.");
			}
			const buffer = Buffer.from(await response.arrayBuffer());
			const stream = new PassThrough();
			stream.end(buffer);
				return {
					...meta,
					stream,
					buffer
				};
			} 
		catch(error) 
		{
			throw Utils.getInternalError("Failed to download file.");
		}
	},

	async post(url, body = {}, headers = {}) 
    {
        try 
        {
            Utils.logInfo(`Making POST request to ${url} with body: `+ JSON.stringify(body), " and headers: " + JSON.stringify(headers), "postToEndpoint");
            const response = await axios.post(url, body, { headers });
            return response.data;
        } 
        catch(error) 
        {
            Utils.logError(error, "postToEndpoint");
            throw error.response?.data || error.message || error;
        }
    }
}
module.exports = Utils;