const { getCategories, saveCategory, deleteCategory } = require("../../services/appService");

Page({
  data: {
    categories: []
  },

  onShow() {
    this.loadCategories();
  },

  loadCategories() {
    this.setData({
      categories: getCategories()
    });
  },

  createCategory() {
    wx.showModal({
      title: "新增分类",
      editable: true,
      placeholderText: "输入分类名称",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const name = String(res.content || "").trim();
        if (!name) {
          return;
        }
        saveCategory({ name });
        this.loadCategories();
      }
    });
  },

  editCategory(event) {
    const current = this.data.categories.find((item) => item.id === event.currentTarget.dataset.id);
    if (!current) {
      return;
    }
    wx.showModal({
      title: "编辑分类",
      editable: true,
      content: current.name,
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const name = String(res.content || "").trim();
        if (!name) {
          return;
        }
        saveCategory({
          ...current,
          name
        });
        this.loadCategories();
      }
    });
  },

  removeCategory(event) {
    deleteCategory(event.currentTarget.dataset.id);
    this.loadCategories();
  }
});
