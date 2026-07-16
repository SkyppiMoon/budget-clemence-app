import { supabase } from "./supabase.js";

async function getCurrentUserId() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("Utilisateur non connecté");
  }

  return user.id;
}

export async function loadIncomes() {
  const { data, error } = await supabase
    .from("incomes")
    .select("*")
    .order("created_at", {
      ascending: true
    });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", {
      ascending: true
    });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function loadTransactions(month) {
  const firstDay = `${month}-01`;

  const nextMonthDate =
    new Date(`${month}-01T12:00:00`);

  nextMonthDate.setMonth(
    nextMonthDate.getMonth() + 1
  );

  const nextMonth =
    nextMonthDate.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("budget_month", firstDay)
    .lt("budget_month", nextMonth)
    .order("transaction_date", {
      ascending: false
    });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createIncome(income) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("incomes")
    .insert({
      user_id: userId,
      name: income.name,
      amount: income.amount
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateIncome(
  incomeId,
  income
) {
  const { data, error } = await supabase
    .from("incomes")
    .update({
      name: income.name,
      amount: income.amount
    })
    .eq("id", incomeId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteIncome(incomeId) {
  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", incomeId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createCategory(category) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      code: category.code ?? null,
      name: category.name,
      type: category.type,
      budget: category.budget,
      is_bill: category.isBill,
      due_day: category.dueDay ?? null
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateCategory(
  categoryId,
  category
) {
  const { data, error } = await supabase
    .from("categories")
    .update({
      name: category.name,
      type: category.type,
      budget: category.budget,
      is_bill: category.isBill,
      due_day: category.dueDay ?? null
    })
    .eq("id", categoryId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCategory(
  categoryId
) {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createTransaction(
  transaction
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: transaction.categoryId,
      transaction_date: transaction.date,
      budget_month: `${transaction.month}-01`,
      amount: transaction.amount,
      vendor: transaction.vendor || null,
      notes: transaction.notes || null
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateTransaction(
  transactionId,
  transaction
) {
  const { data, error } = await supabase
    .from("transactions")
    .update({
      category_id: transaction.categoryId,
      transaction_date: transaction.date,
      budget_month: `${transaction.month}-01`,
      amount: transaction.amount,
      vendor: transaction.vendor || null,
      notes: transaction.notes || null
    })
    .eq("id", transactionId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTransaction(
  transactionId
) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message);
  }
}
export async function loadMonthlyCategoryBudgets(month) {
  const budgetMonth = `${month}-01`;

  const { data, error } = await supabase
    .from('category_monthly_budgets')
    .select('*')
    .eq('budget_month', budgetMonth);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
export async function ensureMonthlyCategoryBudgets(
  month,
  categories
) {
  const userId = await getCurrentUserId();
  const budgetMonth = `${month}-01`;

  const rows = categories.map(category => ({
    user_id: userId,
    category_id: category.id,
    budget_month: budgetMonth,
    budget: Number(category.budget) || 0,
    is_enabled: true
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from('category_monthly_budgets')
      .upsert(rows, {
        onConflict: 'user_id,category_id,budget_month',
        ignoreDuplicates: true
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  return loadMonthlyCategoryBudgets(month);
}

export async function updateMonthlyCategoryBudget(
  monthlyBudgetId,
  changes
) {
  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  if (changes.budget !== undefined) {
    updatePayload.budget = changes.budget;
  }

  if (changes.isEnabled !== undefined) {
    updatePayload.is_enabled =
      changes.isEnabled;
  }

  const { data, error } = await supabase
    .from('category_monthly_budgets')
    .update(updatePayload)
    .eq('id', monthlyBudgetId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
export async function createMonthlyCategoryBudget(
  categoryId,
  month,
  budget,
  isEnabled = true
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('category_monthly_budgets')
    .insert({
      user_id: userId,
      category_id: categoryId,
      budget_month: `${month}-01`,
      budget,
      is_enabled: isEnabled
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
