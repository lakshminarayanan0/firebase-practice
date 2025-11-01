const dsmodel = require("./dsmodel");


class Customer
{
	static TABLENAME = "Customers";
	static TABLEID = "1721000000590019";

	static getModel()
	{
		return new Customer();
	}

	static fromRow(row)
	{
		if(row != null)
		{
			let customer = new Customer();
			if(row.hasOwnProperty(Customer.TABLENAME))
			{
				row = row[Customer.TABLENAME];
			}
			customer.mobile = row.MOBILE;
			customer.wallet = row.WALLET ? parseFloat(row.WALLET) : 0;
			customer.org = row.ORG;
			customer.amount = row.AMOUNT ? parseFloat(row.AMOUNT) : 0;
			customer.reference_id = row.REFERENCE_ID;
			dsmodel.fillDefaultFields(customer, row);
			return customer;
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
			this.mobile = data.mobile;
			this.wallet = data.wallet;
			this.org = data.org;
			this.amount = data.amount;
			this.reference_id = data.reference_id;
		}
	}

	getAsRow()
	{
		let row = {};
		row.MOBILE = this.mobile;
		row.WALLET = this.wallet || 0;
		if(this.org)
		{
			row.ORG = this.org;
		}
		row.AMOUNT = this.amount;
		row.REFERENCE_ID = this.reference_id;
		dsmodel.fillDefaultColumns(row, this);
		return row;
	}

	static getQueryByMobile(mobile, org)
	{
		let query = `SELECT * FROM Customers WHERE MOBILE = '${mobile}'`;
		if(org)
		{
			query += ` AND ORG = '${org}'`;
		}
		return query;
	}
}

module.exports = {
	Customer
}