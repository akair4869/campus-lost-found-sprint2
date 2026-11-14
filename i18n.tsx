import { createContext, useContext } from "react";
export type Language = "en" | "ar";
export const LanguageContext = createContext<Language>("en");
const labels: Record<string, string> = {
  Electronics: "إلكترونيات",
  "Bags & accessories": "حقائب وإكسسوارات",
  "Books & stationery": "كتب وقرطاسية",
  "Keys & cards": "مفاتيح وبطاقات",
  Clothing: "ملابس",
  Other: "أخرى",
  "Central Library": "المكتبة المركزية",
  "College of Computer Science": "كلية علوم الحاسب",
  "Student Center": "مركز الطلاب",
  "Science Building": "مبنى العلوم",
  "Main Gate": "البوابة الرئيسية",
  "Library reception": "استقبال المكتبة",
  "Student services desk": "مكتب خدمات الطلاب",
  "Main security office": "مكتب الأمن الرئيسي",
  "Ground floor · information counter": "الطابق الأرضي · مكتب الاستعلامات",
  "Ground floor · main lobby": "الطابق الأرضي · الردهة الرئيسية",
  "Gate entrance · security counter": "مدخل البوابة · مكتب الأمن",
  lost: "مفقود",
  found: "موجود",
  awaiting: "بانتظار التسليم",
  received: "في مكتب الاستلام",
  returned: "تمت إعادته",
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  collected: "تم الاستلام",
  reported: "تم حفظ البلاغ",
  match: "تم العثور على تطابق محتمل",
  claimSubmitted: "تم إرسال طلب إثبات الملكية",
  reviewNeeded: "طلب ملكية جديد للمراجعة",
  withdrawn: "تم سحبه",
  handedOver: "سُلّم إلى الأمن",
  "Confirm that you handed the item to security first.":
    "أكّد أولاً أنك سلّمت الغرض إلى الأمن.",
  "Security staff already confirmed this item.": "أكّد موظفو الأمن استلام هذا الغرض بالفعل.",
  "You already marked this item as handed over.": "سبق أن سجّلت تسليم هذا الغرض.",
  "The item was already handed to this desk.": "تم تسليم الغرض إلى هذا المكتب بالفعل.",
  hidden: "أخفاه موظفو الأمن",
  restored: "أعيد نشر البلاغ",
  flagged: "تم الإبلاغ عن منشور",
  false: "معلومات غير صحيحة",
  inappropriate: "محتوى غير لائق",
  duplicate: "بلاغ مكرر",
  spam: "إزعاج أو إعلان",
  other: "سبب آخر",
  open: "مفتوح",
  actioned: "تم الإخفاء",
  dismissed: "تم التجاهل",
  "Report not found.": "البلاغ غير موجود.",
  "This report can no longer be edited.": "لم يعد بالإمكان تعديل هذا البلاغ.",
  "This report can no longer be withdrawn.": "لم يعد بالإمكان سحب هذا البلاغ.",
  "This report was hidden by security staff.": "أخفى موظفو الأمن هذا البلاغ.",
  "This item is already at the collection desk. Ask security staff for help.":
    "الغرض موجود في مكتب الاستلام. تواصل مع موظفي الأمن للمساعدة.",
  "The finder withdrew this report.": "سحب الشخص الذي وجد الغرض هذا البلاغ.",
  "This post was removed by security staff.": "أزال موظفو الأمن هذا المنشور.",
  "Choose a reason.": "اختر سبباً.",
  "You cannot report your own post.": "لا يمكنك الإبلاغ عن منشورك.",
  "You already reported this post.": "سبق أن أبلغت عن هذا المنشور.",
  "This post is already hidden.": "هذا المنشور مخفي بالفعل.",
  "This post is not hidden.": "هذا المنشور غير مخفي.",
  "This item has an approved owner and cannot be hidden.":
    "لهذا الغرض مالك معتمد ولا يمكن إخفاؤه.",
  "This name already exists.": "هذا الاسم موجود بالفعل.",
  "Keep at least one active entry.": "أبقِ عنصراً واحداً مفعلاً على الأقل.",
  "Entry not found.": "العنصر غير موجود.",
  "Please sign in to continue.": "يرجى تسجيل الدخول للمتابعة.",
  "Email or password is incorrect.":
    "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "An account already exists for this email.":
    "يوجد حساب مسجل بهذا البريد الإلكتروني.",
  "Password must contain 10–128 characters.":
    "يجب أن تتكون كلمة المرور من 10 إلى 128 حرفاً.",
  "Enter a valid email address.": "أدخل بريداً إلكترونياً صحيحاً.",
  "Staff access is required.": "هذه العملية متاحة لموظفي الأمن فقط.",
  "You already submitted a claim for this item.":
    "سبق أن أرسلت طلب ملكية لهذا الغرض.",
  "You cannot claim an item you reported as found.":
    "لا يمكنك المطالبة بغرض أبلغت عن العثور عليه.",
  "This item is unavailable for claims.": "هذا الغرض غير متاح لطلبات الملكية.",
  "This item already has an approved owner.":
    "تم اعتماد مالك لهذا الغرض بالفعل.",
  "Check the item into the collection desk before approval.":
    "يجب تأكيد وصول الغرض إلى مكتب الاستلام قبل الموافقة.",
  "This claim has already been reviewed.": "تمت مراجعة هذا الطلب بالفعل.",
  "Another claim was approved for this item.":
    "تم قبول طلب ملكية آخر لهذا الغرض.",
  "Another ownership claim was approved.": "تم قبول طلب ملكية آخر.",
  "Pickup code is invalid, expired, or already used.":
    "رمز الاستلام غير صالح أو منتهي الصلاحية أو مستخدم مسبقاً.",
  "Confirm identity and physical handover first.":
    "أكد التحقق من الهوية وتسليم الغرض أولاً.",
  "Item is not available at the desk.": "الغرض غير متاح في مكتب الاستلام.",
  "Item is already checked in or unavailable.":
    "تم تأكيد وصول الغرض مسبقاً أو أنه غير متاح.",
  "Staff cannot review their own claim.":
    "لا يمكن للموظف مراجعة طلب الملكية الخاص به.",
  "Staff cannot complete their own pickup.":
    "لا يمكن للموظف تأكيد استلامه الشخصي.",
  "Photo must be under 5 MB.": "يجب ألا يتجاوز حجم الصورة 5 ميغابايت.",
  "Choose a JPG, PNG, or WebP photo.": "اختر صورة بصيغة JPG أو PNG أو WebP.",
  "Invalid image file.": "ملف الصورة غير صالح.",
  "Could not read this photo.": "تعذرت قراءة الصورة.",
  "Too many attempts. Try again in 10 minutes.":
    "محاولات كثيرة. حاول مرة أخرى بعد 10 دقائق.",
  "Start the local server to use this page. See README.md.":
    "شغّل الخادم المحلي لاستخدام الصفحة. راجع ملف README.md.",
  "Enter a title of 3–100 characters.": "أدخل عنواناً من 3 إلى 100 حرف.",
  "Enter a description of 10–2,000 characters.":
    "أدخل وصفاً من 10 إلى 2000 حرف.",
  "Select an item category.": "اختر فئة الغرض.",
  "Select a campus building.": "اختر مبنى في الحرم الجامعي.",
  "Enter a valid date that is not in the future.":
    "أدخل تاريخاً صحيحاً ليس في المستقبل.",
  "Select a collection point.": "اختر نقطة استلام.",
  "Could not complete the request. Please try again.":
    "تعذر إكمال الطلب. يرجى المحاولة مجدداً.",
};
const extraLabels: Record<string, string> = {};
export function setExtraLabels(entries: { name: string; nameAr: string }[]) {
  for (const e of entries) if (e.nameAr) extraLabels[e.name] = e.nameAr;
}
export function useLanguage() {
  const lang = useContext(LanguageContext);
  return {
    lang,
    t: (en: string, ar: string) => (lang === "ar" ? ar : en),
    label: (s: string) =>
      lang === "ar"
        ? extraLabels[s] || labels[s] || s
        : (
            {
              lost: "Still missing",
              found: "Found",
              awaiting: "Awaiting drop-off",
              received: "At collection desk",
              returned: "Returned",
              pending: "Pending review",
              approved: "Approved",
              rejected: "Rejected",
              collected: "Collected",
              reported: "Report saved",
              match: "Possible match found",
              claimSubmitted: "Claim submitted",
              reviewNeeded: "New claim to review",
              withdrawn: "Withdrawn",
              handedOver: "Handed to security",
              hidden: "Hidden by security",
              restored: "Post restored",
              flagged: "Post reported for review",
              false: "False information",
              inappropriate: "Inappropriate content",
              duplicate: "Duplicate report",
              spam: "Spam or advertising",
              other: "Other reason",
              open: "Open",
              actioned: "Hidden",
              dismissed: "Dismissed",
            } as Record<string, string>
          )[s] || s,
  };
}
