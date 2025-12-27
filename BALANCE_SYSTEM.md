# Money Tracker - Balance Calculation

## ✅ Dynamic Balance System

**Current Balance Formula:**

```
Account Balance = Opening Balance 
                + Income to this account
                + Transfers INTO this account
                - Expenses from this account
                - Transfers OUT OF this account
```

## How It Works

### When you add transactions:

**Income Transaction:**
- Amount is ADDED to the "To Account"
- Dashboard balance increases

**Expense Transaction:**
- Amount is SUBTRACTED from the "From Account"
- Dashboard balance decreases

**Transfer Transaction:**
- Amount is SUBTRACTED from "From Account"
- Amount is ADDED to "To Account"
- Total balance stays the same

### Example

**Starting:**
- Bank Account: ₹10,000 (opening balance)

**Add Income:**
- ₹5,000 salary → Bank Account
- **New Balance: ₹15,000**

**Add Expense:**
- ₹2,000 groceries from Bank Account
- **New Balance: ₹13,000**

**Transfer:**
- ₹3,000 from Bank to Cash
- Bank: ₹10,000
- Cash: ₹3,000
- **Total still ₹13,000**

## Dashboard Shows

**Real-time balances:**
- By type: Bank, Cash, Investment
- Current month income/expense
- Net balance

**All automatic!** No manual updates needed.
