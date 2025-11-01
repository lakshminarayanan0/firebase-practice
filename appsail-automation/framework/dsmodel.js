
// const TokenUtils = require('../security/tokenUtils.js');
const Utils = require('./utils.js');

const TABLES = {
  Channel: "Channels",
  ChannelsGroup: "ChannelsGroup",
};

class User
{
	static getModel()
	{
		return new User();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			let user = new User();
			user.id = row.user_id;
			user.user_id = row.user_id;
			user.zuid = row.zuid;
			user.email = row.email_id;
			if(row.status == "ACTIVE")
			{
				user.status = "active";
			}
			else if(row.status == "DISABLED")
			{
				user.status = "inactive";
			}
			user.first_name = row.first_name;
			user.last_name = row.last_name;
			user.confirmed = row.is_confirmed;
			if(row.role_details != null)
			{
				user.role = {
					name : row.role_details.role_name,
					id : row.role_details.role_id
				};
			}
			user.locale = row.locale;
			user.time_zone = row.time_zone;
			user.org_id = row.org_id;
			return user;
		}
		else 
		{
			return null;
		}
	}

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.user_id = data.user_id;
			this.zuid = data.zuid;
			this.email = data.email;
			this.status = data.status;
			this.first_name = data.first_name;
			this.last_name = data.last_name;
			this.confirmed = data.confirmed;
			this.role = data.role;
			this.locale = data.locale;
			this.time_zone = data.time_zone;
			this.org_id = data.org_id;
		}
	}

	isAdmin()
	{
		if(this.role != null && this.role.name.includes("Administrator"))
		{
			return true;
		}
		else
		{
			return false;
		}
	}

	getAsRow()
	{
		let row = {};
		row.first_name = this.first_name;
		row.last_name = this.last_name;
		row.email_id = this.email;
		row.locale = this.locale;
		row.time_zone = this.time_zone;
		row.user_id = this.user_id;
		if(this.role != null)
		{
			row.role_id = this.role.id;
		}
		return row;
	}
}

class ChannelsGroup
{
	static TABLENAME = "ChannelsGroup";
	static TABLEID = "20923000001633766";
	static CHILDREN = [TABLES.Channel];
	static COLUMNS = {
		ROWID : "ROWID",
		PLATFORM_ID : "PLATFORM_ID",
		BUSINESS :"BUSINESS",
	};

	static getModel()
	{
		return new ChannelsGroup();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			if(row.hasOwnProperty(ChannelsGroup.TABLENAME))
			{
				row = row[ChannelsGroup.TABLENAME];
			}
			let channelsGroup = new ChannelsGroup();
			channelsGroup.id = row.ROWID;
			channelsGroup.platform_id = row.PLATFORM_ID;
			if(row.BUSINESS != null)
			{
				channelsGroup.business = {id: row.BUSINESS};
			}
			else
			{
				channelsGroup.business = row.BUSINESS;
			}			
			if(row.PLATFORM_INFO != null)
			{
				channelsGroup.platform_info = JSON.parse(row.PLATFORM_INFO)
			}
			else
			{
				channelsGroup.platform_info = row.PLATFORM_INFO;
			}
			channelsGroup.#metaToken = row.META_TOKEN;
			channelsGroup.label = row.LABEL;
			fillDefaultFields(channelsGroup, row);
			return channelsGroup;
		}
		else
		{
			return null;
		}
	}

	#metaToken;

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.platform_id = data.platform_id;
			this.platform_info = data.platform_info;
			this.business = data.business;
			this.label = data.label;
			this.#metaToken =  data.meta_token;
		}
	}

	getAsRow()
	{
		let row = {};
		row.PLATFORM_ID = this.platform_id;
		if(this.business != null)
		{
			row.BUSINESS = this.business.id;
		}
		if(this.platform_info != null)
		{
			row.PLATFORM_INFO = JSON.stringify(this.platform_info);
		}
		row.META_TOKEN = this.#metaToken;
		row.LABEL = this.label;
		fillDefaultColumns(row, this);
		return row;
	}

	setMetaToken(metaToken)
	{
		this.#metaToken = metaToken;
	}

	// getMetaToken()
	// {
	// 	let decrypted = new TokenUtils().decryptFromStorage(this.#metaToken);
	// 	return decrypted;
	// }

	static getQueryByPlatformId(platformId)
	{
		return `SELECT * FROM ChannelsGroup WHERE ChannelsGroup.PLATFORM_ID = '${platformId}'`;
	}

	getQueryById(id)
	{
		return `SELECT * FROM ChannelsGroup WHERE ChannelsGroup.ROWID = '${id}'`;
	}

	static getQueryByBusinessId(businessId)
	{
		return `SELECT * FROM ChannelsGroup WHERE ChannelsGroup.BUSINESS = '${businessId}'`;
	}
}

class Channel
{
	static TABLENAME = "Channels";
	static TABLEID = "20923000000058046";
	static CHILDREN = [TABLES.ChannelsGroup];
	static COLUMNS = {
		ROWID : "ROWID",
		BUSINESS : "BUSINESS",
		CHANNELS_GROUP : "CHANNELS_GROUP",
	};
	static COMMUNICATION_LEVEL = {
		REACTIVE : "reactive",
		PROACTIVE : "proactive"
	};

	static getModel()
	{
		return new Channel();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			const container = row;
			let channel = new Channel();
			if (container.hasOwnProperty(Channel.TABLENAME))
			{
				row = container[Channel.TABLENAME];
			}
			else
			{
				row = container;
			}
			channel.handle = row.HANDLE;
			channel.channel_id = row.CHANNEL_ID;
			channel.label = row.LABEL;
			channel.platform = row.PLATFORM;
			channel.status = row.STATUS;
			channel.communication_level = row.COMMUNICATION_LEVEL;
			if(row.BUSINESS != null)
			{
				channel.business = {id: row.BUSINESS};
			}
			else
			{
				channel.business = row.BUSINESS;
			}
			if(row.CHANNEL_INFO != null)
			{
				channel.channel_info = JSON.parse(row.CHANNEL_INFO);
			}
			else
			{
				channel.channel_info = null;
			}
			if(container.hasOwnProperty(ChannelsGroup.TABLENAME) && container[ChannelsGroup.TABLENAME])
			{				
				channel.channels_group = ChannelsGroup.fromRow(container[ChannelsGroup.TABLENAME]);
			}
			else if(container.hasOwnProperty("CHANNELS_GROUP") && container["CHANNELS_GROUP"])
			{
				channel.channels_group = {id : row.CHANNELS_GROUP};
			}
			else
			{				
				channel.channels_group = row.CHANNELS_GROUP;
			}
			fillDefaultFields(channel, row);
			return channel;
		}
		else
		{
			return null;
		}
	}

	#metaToken;

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.handle = data.handle;
			this.label = data.label;
			this.channel_id = data.channel_id;
			this.platform = data.platform;
			this.status = data.status;
			this.business = data.business;
			this.channel_info = data.channel_info;
			this.config = data.config;
			this.communication_level = data.communication_level;
			this.channels_group =  data.channels_group;
		}
	}

	getAsRow()
	{
		let row = {};
		row.HANDLE = this.handle;
		row.CHANNEL_ID = this.channel_id;
		row.LABEL = this.label;
		row.PLATFORM = this.platform;
		row.STATUS = this.status;
		row.COMMUNICATION_LEVEL = this.communication_level;
		if(this.business != null)
		{
			row.BUSINESS = this.business.id;
		}
		if(this.channel_info != null)
		{
			row.CHANNEL_INFO = JSON.stringify(this.channel_info);
		}
		if(this.channels_group)
		{
			row.CHANNELS_GROUP =  this.channels_group.id;
		}
		fillDefaultColumns(row, this);
		return row;
	}

	static getQueryForAll()
	{
		return "SELECT * FROM Channels";
	}

	getQueryById(id)
	{
		return "SELECT * FROM Channels LEFT JOIN Channelsgroup ON Channels.CHANNELS_GROUP = Channelsgroup.ROWID WHERE Channels.ROWID='" + id + "'";
	}

	getQueryByChannelId(channelId)
	{
		return "SELECT * FROM Channels LEFT JOIN Channelsgroup ON Channels.CHANNELS_GROUP = Channelsgroup.ROWID WHERE CHANNEL_ID='"+channelId+"'";
	}

	getQueryByChannelByHandle(handle)
	{
		return "SELECT * FROM Channels LEFT JOIN Channelsgroup ON Channels.CHANNELS_GROUP = Channelsgroup.ROWID WHERE HANDLE='"+handle+"'";
	}

	getQueryByPlatform(platform)
	{
		return "SELECT * FROM Channels WHERE PLATFORM='"+platform+"'";
	}
}

class Business
{
	static TABLENAME = "Business";
	static TABLEID = "20923000000050317";
	static CHILDREN = [ChannelsGroup.TABLENAME, Channel.TABLENAME];
	static COLUMNS = {
		ROWID : "ROWID",
	};

	static getModel()
	{
		return new Business();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			if(row.hasOwnProperty(Business.TABLENAME))
			{
				row = row[Business.TABLENAME];
			}
			let business = new Business();
			business.id = row.ROWID;
			business.org_id = row.ORG_ID;
			business.super_admin_id = row.SUPER_ADMIN_ID;
			business.super_admin_email = row.SUPER_ADMIN_EMAIL;
			business.date_time_format = row.DATE_TIME_FORMAT;
			business.name = row.NAME;
			business.time_zone = row.TIME_ZONE;
			business.#apiKey = row.API_KEY;
			business.#metaAdToken = row.META_AD_TOKEN;
			business.country = row.COUNTRY;
			if(row.CONFIGS != null)
			{
				business.configs = JSON.parse(row.CONFIGS);
			}
			else
			{
				business.configs = row.CONFIGS;
			}

			let groups = [];
			let channels = [];
			if (Array.isArray(row[ChannelsGroup.TABLENAME]))
			{
				groups = row[ChannelsGroup.TABLENAME];
			}
			if (Array.isArray(row[Channel.TABLENAME]))
			{
				channels = row[Channel.TABLENAME];
			}
			Business.attachChannelsGroups(business, groups, channels);
			return business;
		}
		else
		{
			return null;
		}
	}

	static attachChannelsGroups(business, groups, channels) {
		const channelsByGroupId = new Map();

		for(const chRow of channels)
		{
			const groupId = chRow.CHANNELS_GROUP;
			if (!channelsByGroupId.has(groupId)) channelsByGroupId.set(groupId, []);
			channelsByGroupId.get(groupId).push(Channel.fromRow(chRow));
		}

		const uniqueGroupsMap = new Map();

		for(const groupRow of groups)
		{
			const groupId = groupRow.id || groupRow.ROWID;
			if (!uniqueGroupsMap.has(groupId)) {
				uniqueGroupsMap.set(groupId, groupRow);
			}
		}

		const uniqueGroupsArr = Array.from(uniqueGroupsMap.values());

		if(uniqueGroupsArr.length > 0)
		{
			business.channels_group = uniqueGroupsArr.map((groupRow) => {
				const group = ChannelsGroup.fromRow(groupRow);
				const groupId = group.id || groupRow.ROWID;
				group.channels = channelsByGroupId.get(groupId) || [];
				return group;
			});
		}
	}

	#apiKey;
	#metaAdToken;

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.org_id = data.org_id;
			this.super_admin_id = data.super_admin_id;
			this.date_time_format = data.date_time_format;
			this.super_admin_email = data.super_admin_email;
			this.name = data.name;
			this.time_zone = data.time_zone;
			this.configs = data.configs;
			this.#apiKey = data.api_key;
			this.#metaAdToken = data.meta_ad_token;
			this.country = data.country;
		}
	}

	getAsRow()
	{
		let row = {};
		row.ROWID = this.id;
		row.ORG_ID = this.org_id;
		row.SUPER_ADMIN_ID = this.super_admin_id;
		row.DATE_TIME_FORMAT = this.date_time_format;
		row.SUPER_ADMIN_EMAIL = this.super_admin_email;
		row.NAME = this.name;
		row.META_AD_TOKEN = this.#metaAdToken;
		row.TIME_ZONE = this.time_zone;
		row.API_KEY = this.#apiKey;
		row.COUNTRY = this.country;
		if(this.configs != null)
		{
			if(Object.keys(this.configs).length > 0)
			{
				row.CONFIGS = JSON.stringify(this.configs);
			}
			else
			{
				row.CONFIGS = null;
			}
		}
		else
		{
			row.CONFIGS = this.configs;
		}
		return row;
	}

	setAPIKey(apiKey)
	{
		this.#apiKey = apiKey;
	}

	getAPIKey()
	{
		return this.#apiKey;
	}

	setMetaAdsToken(tokenData) {
		this.#metaAdToken = typeof tokenData == "string" ? tokenData : JSON.stringify(tokenData);
	}

	// getMetaAdToken() {
	// 	let parsedData = JSON.parse(this.#metaAdToken);
	// 	parsedData.access_token = new TokenUtils().decryptFromStorage(parsedData.access_token);
	// 	return parsedData;
	// }

	static getQueryForSingle() {
		return "SELECT Business.*, ChannelsGroup.*, Channels.* FROM Business " +
			"LEFT JOIN ChannelsGroup ON ChannelsGroup.BUSINESS = Business.ROWID " +
			"LEFT JOIN Channels ON Channels.CHANNELS_GROUP = ChannelsGroup.ROWID";
	}

	static getQueryById(id)
	{
		return (
			"SELECT Business.*, ChannelsGroup.*, Channels.* FROM Business " +
			"LEFT JOIN ChannelsGroup ON ChannelsGroup.BUSINESS = Business.ROWID " +
			"LEFT JOIN Channels ON Channels.CHANNELS_GROUP = ChannelsGroup.ROWID " +
			`WHERE Business.ROWID = '${id}'`
		);
	}

	static getQueryByWabaId(wabaPlatformId) 
	{
		let query = SQL.SELECT + Business.TABLENAME + ".*," + Channel.TABLENAME + ".*," + ChannelsGroup.TABLENAME + ".*" + SQL.FROM + Business.TABLENAME + SQL.LEFT_JOIN + ChannelsGroup.TABLENAME + SQL.ON + ChannelsGroup.TABLENAME + "." + ChannelsGroup.COLUMNS.BUSINESS + " = " + Business.TABLENAME + "." + Business.COLUMNS.ROWID + SQL.LEFT_JOIN + Channel.TABLENAME + SQL.ON + Channel.TABLENAME + "." + Channel.COLUMNS.CHANNELS_GROUP + " = " + ChannelsGroup.TABLENAME + "." + ChannelsGroup.COLUMNS.ROWID + SQL.WHERE + ChannelsGroup.TABLENAME + "." + ChannelsGroup.COLUMNS.PLATFORM_ID + " = '" + wabaPlatformId + "'";
		return query;
	}

	static getQueryByAPIKey(encryptedKey)
	{
		return "SELECT * FROM Business WHERE API_KEY = '"+ encryptedKey +"'";
	}
}

class View
{
	static TABLENAME = "ListViews";
	static TABLEID = "20923000001396820";
	#module;
	static getModel()
	{
		return new View();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			if(row.hasOwnProperty(View.TABLENAME))
			{
				row = row[View.TABLENAME];
			}
			let view = new View();
			view.name = row.NAME;
			view.label = row.LABEL;
			if(row.FIELDS != null)
			{
				view.fields = JSON.parse(row.FIELDS);
			}
			else
			{
				view.fields = null;
			}
			if(row.CRITERIA != null)
			{
				view.criteria = JSON.parse(row.CRITERIA);
			}
			else
			{
				view.criteria = null;
			}
			if(row.MODULE != null)
			{
				view.#module = {id: row.MODULE};
			}
			else
			{
				view.#module = null;
			}
			view.classification = row.CLASSIFICATION;	
			
			fillDefaultFields(view,row);
			return view;
		}
		else
		{
          return null;
		}
		
	}

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.name = data.name;
			this.label = data.label;
			this.fields = data.fields;
			this.criteria = data.criteria;
			this.#module = data.module;
			this.classification = data.classification;
		}
	}

	getAsRow()
	{
		let row = {};
		row.NAME = this.name;
		row.LABEL = this.label;
		if(this.fields != null)
		{
			row.FIELDS = JSON.stringify(this.fields);
		}	
		if(this.criteria != null)
		{
			row.CRITERIA = JSON.stringify(this.criteria);
		}
		if(this.#module != null)
		{
			row.MODULE = this.#module.id;
		}
		row.CLASSIFICATION = this.classification;
		fillDefaultColumns(row, this);
		return row;
	}

	getCriteriaInSQL()
	{
		return this.criteria;
	}

	setClassification(value = "CUSTOM") {
		this.classification = value;
	}

	setModuleId(module) {
		this.#module = module;
	}

	getModuleId() {
		return this.#module.id;
	}

	getQueryById(id) {
		return `SELECT * FROM ${View.TABLENAME} WHERE ROWID = '${id}'`;
	}

	static getViewByName(name, moduleId) {
        return `SELECT * FROM ${View.TABLENAME} WHERE NAME = '${name}' AND MODULE = '${moduleId}'`
	}
}

class Field
{
	#column;
	#module_id;
	static TABLENAME = "Fields";
	static TABLEID = "20923000000903618";

	static getModel() {
		return new Field();
	}
	static fromRow(row) {
		if (row != null) {
			if (row.hasOwnProperty(Field.TABLENAME)) {
				row = row[Field.TABLENAME];
			}
			let field = new Field();
			field.id = row.ROWID;
			field.#module_id = row.MODULE;
			field.name = row.NAME;
			field.label = row.LABEL;
			field.type = row.FIELD_TYPE;
			field.#column = row.COLUMN_NAME;
			field.writable = row.IS_WRITABLE != null ? Utils.stringToBoolean(row.IS_WRITABLE) : field.writable;
			field.mandatory = row.IS_MANDATORY != null ? Utils.stringToBoolean(row.IS_MANDATORY) : field.mandatory;
			field.searchable = row.IS_SEARCHABLE != null ? Utils.stringToBoolean(row.IS_SEARCHABLE) : field.searchable;
			field.nullable = row.IS_NULLABLE != null ? Utils.stringToBoolean(row.IS_NULLABLE) : field.nullable;
			field.module = row.RELATED_MODULE != null ? row.RELATED_MODULE : field.module;
			field.max_length = row.MAX_LENGTH != null ? Number(row.MAX_LENGTH) : field.max_length;
			field.allowed_values = row.ALLOWED_VALUES != null ? JSON.parse(row.ALLOWED_VALUES) : field.allowed_values;
			field.classification = row.CLASSIFICATION != null ? row.CLASSIFICATION : field.classification;
			fillDefaultFields(field, row);
			return field;
		} else {
			return null;
		}
	}
	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.name = data.name;
			this.label = data.label;
			this.#column = data.column;
			this.type = data.type;
			this.pattern = data.pattern;
			
			if(data.writable != null){
				this.writable = data.writable
			} else {
				this.writable = false
			}
			this.mandatory = data.mandatory;
			this.searchable = data.searchable;
			this.nullable = data.nullable
			this.max_length = data.max_length
			this.classification = data.classification
			this.allowed_values = data.allowed_values

			if (data.module != null)
			{
				if (data.module.getTable)
				{
					this.module = data.module;
				}
				else
				{
					this.module = new Module({name: data.module.name, table: data.module.table, label_field: data.module.label_field});
				}
			}
			this.model = data.model;
		}
	}

	getColumn()
	{
		return this.#column;
	}

	setColumn(column){
		this.#column = column;
	}
	
	getAsRow() {
		let row = {};
		row.ROWID = this.id;
		row.MODULE = this.#module_id;
		row.NAME = this.name;
		row.LABEL = this.label;
		row.FIELD_TYPE = this.type;
		row.COLUMN_NAME = this.#column;
		row.IS_WRITABLE = this.writable;
		row.IS_MANDATORY = this.mandatory;
		row.IS_SEARCHABLE = this.searchable;
		row.IS_NULLABLE = this.nullable;
		row.RELATED_MODULE = this.module?.name;
		if (this.allowed_values != null) {
			row.ALLOWED_VALUES = JSON.stringify(this.allowed_values);
		}
		row.MAX_LENGTH = this.max_length;
		row.CLASSIFICATION = this.classification;
		
		fillDefaultColumns(row, this);
		return row;
	}

	getQueryById(id) {
		return `SELECT * FROM ${Field.TABLENAME} WHERE ROWID='${id}'`;
	}

	static getFieldByName(name, moduleId) {
		return `SELECT * FROM ${Field.TABLENAME} WHERE NAME = '${name}' AND MODULE = '${moduleId}'`;
	}

	setModuleId(module) {
		this.#module_id = module;
	}

	getModuleId() {
		return this.#module_id;
	}

	setClassification(value = "CUSTOM") {
		this.classification = value;
	}
	
	setWritable(value = true) {
		this.writable = value;
	}
}

class Section
{
	constructor(data, module)
	{
		if(data != null)
		{
			this.name = data.name;
			this.label = data.label;
			this.fields = [];
			data.fields.forEach((fieldName) => {
				this.fields.push(module.getField(fieldName));
			});
		}
	}

	static extractFieldNames(fields) {
		if (!Array.isArray(fields)) {
		  return [];
		}
		
		return fields.map(field => {
		  if (field !== null && typeof field === 'object' && field.name) {
			return field.name;
		  }
		  else if (typeof field === 'string') {
			return field;
		  }
		  return null;
		}).filter(name => name !== null && name !== undefined);
	  }
}

class Layout
{
	static TABLENAME = "Layout";
	static TABLEID = "20923000000929074";
	#module_id;

	static fromRow(row) {
		if (row != null) {
			if (row.hasOwnProperty(Layout.TABLENAME)) {
				row = row[Layout.TABLENAME];
			}
			let layout = new Layout();
			layout.id = row.ROWID;
			layout.name = row.NAME;
			layout.label = row.LABEL;
			if (row.SECTIONS != null) {
				layout.sections = JSON.parse(row.SECTIONS);
			}
			else {
				layout.sections = row.SECTIONS;
			}
			layout.#module_id = row.MODULE;

			fillDefaultFields(layout, row);
			return layout;
		} else {
			return null;
		}
	}

	constructor(data, module)
	{
		if(data != null)
		{
			this.id = data.id;
			this.name = data.name;
			this.label = data.label;
			if(data.sections != null)
			{
				this.sections = [];
				data.sections.forEach((section) => {
					this.sections.push(new Section(section, module));
				});
			}
		}
	}

	getAsRow() {
		let row = {};
		row.ROWID = this.id;
		row.NAME = this.name;
		row.LABEL = this.label;

		this.sections?.forEach(sec => {
			sec.fields = Section.extractFieldNames(sec.fields);
		});
		row.SECTIONS = (this.sections) ? JSON.stringify(this.sections) : "";
		row.MODULE = this.#module_id;
		fillDefaultColumns(row, this);
		return row;
	}

	setModuleId(module) {
		this.#module_id = module;
	}

	getModuleId() {
		return this.#module_id;
	}

	static getLayoutByModule(moduleId) {
		return `SELECT ${Layout.TABLENAME}.* FROM ${Layout.TABLENAME} WHERE ${Layout.TABLENAME}.MODULE = '${moduleId}'`;
	}
}

class Module
{
	#table;
	#queries;
	#system_info;
	static TABLENAME = "Modules";
	static TABLEID = "20923000000879544";
	static CHILDREN = [Field.TABLENAME, Layout.TABLENAME, View.TABLENAME];

	static getModel()
	{
		return new Module();
	}

	static fromRow(row) {
		if (row != null) {
			if (row.hasOwnProperty(Module.TABLENAME)) {
				row = row[Module.TABLENAME];
			}
			let module = new Module();

			module.name = row.NAME;
			module.label_singular = row.LABEL_SINGULAR;
			module.label_plural = row.LABEL_PLURAL;
			module.#table = {
				name: row.TABLE_NAME,
				id: row.TABLE_ID
			};
			module.label_field = row.LABEL_FIELD;
			module.type = row.MODULE_TYPE;
			module.#system_info = JSON.parse(row?.SYSTEM_INFO || null);
			if (row.hasOwnProperty(Field.TABLENAME)) {
				module.fields = getChildWithoutDuplicates(row[Field.TABLENAME],"id",Field);
			}

			if (row.hasOwnProperty(Layout.TABLENAME)) {
				module.layouts = getChildWithoutDuplicates(row[Layout.TABLENAME],"id",Layout);
			}

			if (row.hasOwnProperty(View.TABLENAME)) {
				module.views = getChildWithoutDuplicates(row[View.TABLENAME],"id",View);
			}

			fillDefaultFields(module, row);
			return module;
		} else {
			return null;
		}
	}

	constructor(data)
	{
		if(data != null)
		{
			this.id = data.id;
			this.name = data.name;
			this.label_singular = data.label_singular;
			this.label_plural = data.label_plural;
			this.#table = data.table;
			this.type = data.type;
			if(data.label_field != null)
			{
				this.label_field = new Field({name: data.label_field.name, column: data.label_field.column, label: data.label_field.label});
			}
			if(data.fields != null)
			{
				this.fields = [];
				data.fields.forEach((field) => {
					this.fields.push(new Field(field));
				});
				// this.fields.push(...getDefaultFields());
			}
			if(data.layouts != null)
			{
				this.layouts = [];
				data.layouts.forEach((layout) => {
					this.layouts.push(new Layout(layout, this));
				});
			}
			if(data.views != null)
			{
				this.views = [];
				data.views.forEach((view) => {
					this.views.push(new View(view));
				});
			}
			if(data.related_sections != null)
			{
				this.related_sections = [];
				data.related_sections.forEach((section) => {
					let newSection = {...section};
					if(newSection.related_module != null)
					{
						newSection.related_module = new Module({name: section.related_module});
						newSection.related_field = new Field({name: section.related_field});
					}
					this.related_sections.push(newSection);
				});
			}
			this.#queries = data.queries;
			this.#system_info = data.system_info;
			this.restricted = data.restricted;
		}
	}

	getAsRow() {
		let row = {};
		row.ROWID = this.id;
		row.NAME = this.name;
		row.LABEL_SINGULAR = this.label_singular;
		row.LABEL_PLURAL = this.label_plural;
		row.TABLE_NAME = this.#table?.name || '';
		row.TABLE_ID = this.#table?.id || '';
		row.LABEL_FIELD = this.label_field.name;
		row.MODULE_TYPE = this.type;
		row.SYSTEM_INFO = (this.#system_info) ? JSON.stringify(this.#system_info) : "";
		fillDefaultColumns(row, this);
		return row;
	}

	getTable()
	{
		return this.#table;
	}

	getType()
	{
		return this.type;
	}

	getSubformModules()
	{
		let childModules = [];
		this.fields.forEach((field) => {
			if(field.type == "subform")
			{
				childModules.push(field.module);
			}
		});
		return childModules;
	}

	getQueries()
	{
		return this.#queries;
	}

	getField(name)
	{
		let fieldToReturn;
		this.fields.forEach((field) => {
			if(field.name == name)
			{
				fieldToReturn = field;
			}
		});
		return fieldToReturn;
	}

	getView(name)
	{
		let viewToReturn;
		this.views.forEach((view) => {
			if(view.name == name)
			{
				viewToReturn = view;
			}
		});
		return viewToReturn;
	}

	getQueryForAllRecords()
	{
		let select = "SELECT " + this.getTable().name+".*";
		let joinClause = "";
		this.fields.forEach((field) => {
			if(field.type == "lookup")
			{
				let lookupModule = field.module;
				select += ", " + lookupModule.getTable().name+".*"
				joinClause += " LEFT JOIN " + lookupModule.getTable().name + " ON " + this.getTable().name+"."+field.getColumn() + "=" + lookupModule.getTable().name+".ROWID";
			}
			else if(field.type == "subform" && field.module.fields)
			{
				let subformModule = field.module;
				select += ", " + subformModule.getTable().name+".*"
				joinClause += " LEFT JOIN " + subformModule.getTable().name + " ON " + this.getTable().name+".ROWID" + "=" + subformModule.getTable().name+"."+field.getColumn();
			}
		});
		return select + " FROM " + this.getTable().name + joinClause;
	}

	getSearchClause(searchTerm)
	{
		let searchClause = "";
		if(searchTerm != null && typeof searchTerm == 'string')
		{
			searchTerm = "*"+searchTerm+"*";
			if(this.label_field != null)
			{
				searchClause += this.getTable().name+"."+this.label_field.getColumn() + " LIKE '" + searchTerm + "' OR ";
			}
			this.fields.forEach((field) => {
				if(field.searchable)
				{
					searchClause += this.getTable().name+"."+field.getColumn() + " LIKE '" + searchTerm + "' OR ";
				}
			});
			searchClause = searchClause.substring(0, searchClause.length-4);
		}
		return searchClause;
	}

	getSearchClauseCriteria(searchTerm) {
		let criteria = [];
		if (searchTerm != null && typeof searchTerm == 'string') {
			// searchTerm = "*" + searchTerm + "*";
			if (this.label_field != null) {
				criteria.push({
					field: this.label_field.name,
					comparator: "like",
					value: searchTerm
				});
			}
			this.fields.forEach((field) => {
				if (field.searchable) {
					criteria.push({
						field: field.name,
						comparator: "like",
						value: searchTerm
					});
				}
			});
		}
		return criteria;
	}

	getQueryClauseForSystemInfo(info)
	{
		let queryClause = "";
		if(this.name === "contacts")
		{
			queryClause = `SYSTEM_INFO LIKE '*${info}*' `;
		}
		return queryClause;
	}

	getCriteriaForSystemInfo(info) {
		let criteria = [];
		if (this.name === "contacts") {
			criteria.push({
				field: "SYSTEM_INFO",
				comparator: "like",
				value: "*" + info + "*"
			});
		}
		return criteria;
	}

	static getFullModule(name) {
		return `SELECT ${Module.TABLENAME}.*, ${Field.TABLENAME}.*, ${View.TABLENAME}.*,${Layout.TABLENAME}.* FROM ${Module.TABLENAME} LEFT JOIN ${Field.TABLENAME} ON ${Field.TABLENAME}.MODULE = Modules.ROWID LEFT JOIN ${View.TABLENAME} ON ${View.TABLENAME}.MODULE = ${Module.TABLENAME}.ROWID LEFT JOIN ${Layout.TABLENAME} ON ${Layout.TABLENAME}.MODULE = ${Module.TABLENAME}.ROWID WHERE ${Module.TABLENAME}.NAME = '${name}' AND ${Module.TABLENAME}.MODULE_TYPE = 'form'`;
	}

	static getModuleFields(name) {
		return `SELECT ${Module.TABLENAME}.*, ${Field.TABLENAME}.* FROM ${Module.TABLENAME} LEFT JOIN ${Field.TABLENAME} ON ${Field.TABLENAME}.MODULE = ${Module.TABLENAME}.ROWID WHERE ${Module.TABLENAME}.NAME = '${name}' AND ${Module.TABLENAME}.MODULE_TYPE = 'form'`;
	}

	static getLayoutByModuleName(name) {
		return `SELECT ${Module.TABLENAME}.*, ${Layout.TABLENAME}.*, ${Field.TABLENAME}.* FROM ${Module.TABLENAME} LEFT JOIN ${Layout.TABLENAME} ON ${Layout.TABLENAME}.MODULE = ${Module.TABLENAME}.ROWID LEFT JOIN ${Field.TABLENAME} ON ${Field.TABLENAME}.MODULE = ${Module.TABLENAME}.ROWID WHERE ${Module.TABLENAME}.NAME = '${name}' AND ${Module.TABLENAME}.MODULE_TYPE = 'form'`;
	}

	setSystemInfo(info = null) {
		this.#system_info = info;
	}

	getSystemInfo() {
		return this.#system_info;
	}

	getFieldIndex() {
		return this.getSystemInfo().field_index || {};
	}
	getQueryForEmptyingColumn(columnName) {
		let query = `UPDATE ${this.#table.name} SET ${columnName} = NULL`;
		return query;
	}
}

class Record
{
	static FORM_MODEL = true;
	#module;

	static getModel(module)
	{
		let recordModel = new Record();
		recordModel.#module = module;
		return recordModel;
	}

	constructor(data)
	{
		if(data != null)
		{
			this.setValues(data);
		}
	}

	setValues(data)
	{
		this.id = data.id;
		Object.keys(data).forEach((key) => {
			this[key] = data[key];
		});
	}

	static fromRow(row, module)
	{
		let record = new Record();
		record.#module = module;
		let mainRow = row;
		if(row[module.getTable().name] != null)
		{
			mainRow = row[module.getTable().name];
		}
		if(module.fields != null)
		{
			module.fields.forEach((field) => {
				if(field.type == "user")
				{
					let userId = mainRow[field.getColumn()];
					if(userId != null)
					{
						record[field.name] = {id: userId};
					}
					else
					{
						record[field.name] = null;
					}
				}
				else if(field.type == "lookup" && mainRow[field.getColumn()] != null)
				{
					let lookupModule = field.module;
					let lookupTableName = lookupModule.getTable().name;
					let labelField = lookupModule.label_field;
					if(row[lookupTableName] != null && lookupModule.fields != null)
					{
						record[field.name] = Record.fromRow(row[lookupTableName], lookupModule);
					}
					else if(row[lookupTableName] != null && labelField != null)
					{
						record[field.name] = {id: row[lookupTableName].ROWID, label: row[lookupTableName][labelField.getColumn()]};
					}
					else
					{
						record[field.name] = {id: mainRow[field.getColumn()]};
					}
				}
				else if(field.type == "subform" && mainRow[field.module.getTable().name] != null)
				{
					let subformModule = field.module;
					let subformRows = mainRow[subformModule.getTable().name];
					let subformEntries = [];
					subformRows.forEach((subformRow) => {
						subformEntries.push(Record.fromRow(subformRow, subformModule));
					});
					record[field.name] = subformEntries;
				}
				else if(["object","multi_picklist"].includes(field.type) && mainRow[field.getColumn()] != null)
				{
					record[field.name] = JSON.parse(mainRow[field.getColumn()]);
				}
				else
				{
					record[field.name] = mainRow[field.getColumn()];
				}
			});
			fillDefaultFields(record, mainRow);
		}
		else if(module.label_field != null)
		{
			record.id = mainRow.ROWID;
			record[module.label_field.name] = mainRow[module.label_field.name];
		}
		return record;
	}

	getMeta()
	{
		return this.#module;
	}

	getAsRow()
	{
		let row = {};
		this.#module.fields.forEach((field) => {
			if(["lookup", "user"].includes(field.type))
			{
				if(this[field.name] != null)
				{
                  row[field.getColumn()] = this[field.name].id;
				}
			}
			else if(["object","multi_picklist"].includes(field.type))
			{
				if(this[field.name] != null)
				{
                  row[field.getColumn()] = JSON.stringify(this[field.name]);
				}
			}
			else
			{
				row[field.getColumn()] = this[field.name];
			}
		});
		fillDefaultColumns(row, this);
		return row;
	}

	getQueryForAll()
	{
		return this.#module.getQueryForAllRecords();
	}

	getQueryById(id)
	{
		let query = this.getQueryForAll();
		if(this.#module.getQueries() != null && this.#module.getQueries().by_id != null)
		{
			query = this.#module.getQueries().by_id;
		}
		let criteria = "(" + this.#module.getTable().name+".ROWID = '" + id + "')";
		if(query.includes(" WHERE "))
		{
			query += " AND ";
		}
		else
		{
			query += " WHERE ";
		}
		return query + criteria;
	}

	getQueryForRelatedRecords(relatedSection)
	{
		let relatedModule = relatedSection.related_module;
		let query = relatedModule.getQueryForAllRecords();
		let criteria = "(" + relatedModule.getTable().name+"."+relatedModule.getField(relatedSection.related_field.name).getColumn() + " = '" + this.id + "')";
		if(query.includes(" WHERE "))
		{
			query += " AND ";
		}
		else
		{
			query += " WHERE ";
		}
		return query + criteria;
	}

	getQueryByWANumbersAndEmails(numbers, emails)
	{
		let query = this.getQueryForAll();
		if(query.includes(" WHERE "))
		{
			query += " AND ";
		}
		else
		{
			query += " WHERE";
		}
		let conditions = [];
		if(Utils.isValidArray(numbers) && numbers.length !== 0)
		{
			conditions.push(` MOBILE IN ('${numbers.join("', '")}')`);
		}
		if(Utils.isValidArray(emails) && emails.length !== 0)
		{
			conditions.push(` EMAIL IN ('${emails.join("', '")}')`);
		}
		query += ` ${conditions.join(" OR ")}`;
		return query;
	}
}

function getDefaultFields()
{
	let defaultFields = [];
	defaultFields.push(new Field({name: "id", column: "ROWID", type: "bigint", writable: false}));
	defaultFields.push(new Field({name: "created_by", label: "Created By", column: "CREATORID", type: "user", writable: false}));
	defaultFields.push(new Field({name: "created_time", label: "Created Time", column: "CREATEDTIME", type: "time", writable: false}));
	defaultFields.push(new Field({name: "modified_time", label: "Modified Time", column: "MODIFIEDTIME", type: "time", writable: false}));
	return defaultFields;
}

function fillDefaultFields(object, row)
{
	if(row.ROWID != null)
	{
		object.id = row.ROWID;
		if(row.CREATORID != null)
		{
			object.created_by = {id: row.CREATORID};
		}
		object.created_time = Utils.formatTime(row.CREATEDTIME);
		object.modified_time = Utils.formatTime(row.MODIFIEDTIME);
	}
}

function fillDefaultColumns(row, object)
{
	if(object.id != null)
	{
		row.ROWID = object.id;
		if(object.created_by != null)
		{
			row.CREATORID = object.created_by.id;
		}
		row.CREATEDTIME = object.created_time;
		row.MODIFIEDTIME = object.modified_time;
	}
}

/**
 * if we have multiple left join. duplicate values may come for some models.to avoid.
 */
function getChildWithoutDuplicates(array, key, model) {
	const uniqueMap = new Map();
	
	array.forEach(item => {
	  const processedItem = model ? model.fromRow(item) : item;
	  const keyValue = processedItem?.[key];
	  if (keyValue !== undefined && !uniqueMap.has(keyValue)) {
		uniqueMap.set(keyValue, processedItem);
	  }
	});
	
	return Array.from(uniqueMap.values());
}

const SQL = {
	SELECT : "SELECT ",
	FROM : " FROM ",
	SELECT_FROM : "SELECT * FROM ",
	LEFT_JOIN : " LEFT JOIN ",
	INNER_JOIN : " INNER JOIN ",
	ON : " ON ",
	WHERE : " WHERE ",
	IN : " IN ",
	AND : " AND ",
	LIMIT : " LIMIT ",
	OFFSET : " OFFSET "
}

module.exports = {
	User : User,
	ChannelsGroup : ChannelsGroup,
	Business : Business,
	ChannelsGroup : ChannelsGroup,
	Channel : Channel,
	Module : Module, 
	Field : Field,
	Layout : Layout,
	Section : Section,
	Record : Record,
	View : View,
	fillDefaultColumns : fillDefaultColumns,
	fillDefaultFields : fillDefaultFields,
	getChildWithoutDuplicates : getChildWithoutDuplicates, 
	SQL : SQL
};