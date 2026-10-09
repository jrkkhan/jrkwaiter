import React, { useState, useEffect } from 'react';
import { 
 format, addMonths, subMonths, startOfMonth, endOfMonth, 
 startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval, 
 parse, addDays 
} from 'date-fns';
import { 
 Calendar as CalendarIcon, Users, UserPlus, 
 CheckCircle, Clock, ChevronLeft, ChevronRight, 
 Plus, Search, Bell, Settings, LayoutDashboard, Utensils, Download, MessageCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function App() {
 const [currentDate, setCurrentDate] = useState(new Date());
 
 const [bookings, setBookings] = useState([]);

 useEffect(() => {
 // Fetch data from Firebase
 const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const bookingsData = snapshot.docs.map(doc => {
 const data = doc.data();
 return {
 id: doc.id,
 ...data,
 date: data.date ? new Date(data.date) : new Date()
 };
 });
 setBookings(bookingsData);
 }, (error) => {
 console.error("Error fetching bookings: ", error);
 });
 
 return () => unsubscribe();
 }, []);

 const [currentView, setCurrentView] = useState('calendar');
 const [selectedDate, setSelectedDate] = useState(new Date());
 const [selectedBooking, setSelectedBooking] = useState(null);
 const [receiptLang, setReceiptLang] = useState('en');
 
 // New Booking State
 const [newBooking, setNewBooking] = useState({
 partyName: '',
 date: format(new Date(), 'yyyy-MM-dd'),
 status: 'Pending',
 phone: '',
 altPhone: '',
 location: '',
 eventType: 'Wedding',
 serviceStyle: 'Kada Khana (Buffet)',
 gathering: '',
 waiterDetails: {},
 totalAmount: '',
 advanceAmount: '',
 notes: ''
 });

 // Auto-calculate Total Amount based on Waiters and Charges
 useEffect(() => {
 let total = 0;
 Object.values(newBooking.waiterDetails || {}).forEach(detail => {
 const count = Number(detail.count) || 0;
 const charge = Number(detail.charge) || 0;
 let multiplier = 1;
 if (detail.shift === 'Ded hazri') multiplier = 1.5;
 else if (detail.shift === 'Double hazri') multiplier = 2;
 total += count * charge * multiplier;
 });
 
 // Only auto-update if total > 0 (so manual entry isn't erased if waiters are 0)
 if (total > 0) {
 setNewBooking(prev => ({ ...prev, totalAmount: total }));
 }
 }, [newBooking.waiterDetails]);

 const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
 const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

 const handleDateClick = (day) => {
 setSelectedDate(day);
 setNewBooking({ ...newBooking, date: format(day, 'yyyy-MM-dd') });
 setCurrentView('newBooking');
 };

 const handleAddBooking = async (e) => {
 e.preventDefault();
 const totalWaiters = Object.values(newBooking.waiterDetails || {}).reduce((sum, detail) => sum + Number(detail.count || 0), 0);
 
 try {
 if (newBooking.id) {
 // Update existing booking
 const docRef = doc(db, 'bookings', newBooking.id);
  const updateData = {
  ...newBooking,
  bookingId: newBooking.bookingId || `JRK${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
  date: newBooking.date,
  waiters: totalWaiters > 0 ? totalWaiters : 1,
  updatedAt: serverTimestamp()
 };
 delete updateData.id; // Don't save the id inside the document fields
 await updateDoc(docRef, updateData);
 } else {
 // Create new booking
 const bookingToAdd = {
 ...newBooking,
 bookingId: `JRK${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
 date: newBooking.date,
 waiters: totalWaiters > 0 ? totalWaiters : 1,
 createdAt: serverTimestamp()
 };
 await addDoc(collection(db, 'bookings'), bookingToAdd);
 }
 
 setCurrentView('calendar');
 setNewBooking({ partyName: '', date: format(new Date(), 'yyyy-MM-dd'), status: 'Pending', phone: '', altPhone: '', location: '', eventType: 'Wedding', serviceStyle: 'Kada Khana (Buffet)', gathering: '', waiterDetails: {}, totalAmount: '', advanceAmount: '', notes: '' });
 } catch (error) {
 console.error("Error saving document: ", error);
 alert("Error saving booking: " + error.message);
 }
 };

 const handleDeleteBooking = async () => {
 if (!newBooking.id) return;
 if (!window.confirm("Are you sure you want to delete this booking?")) return;
 
 try {
 await deleteDoc(doc(db, 'bookings', newBooking.id));
 setCurrentView('calendar');
 setNewBooking({ partyName: '', date: format(new Date(), 'yyyy-MM-dd'), status: 'Pending', phone: '', altPhone: '', location: '', eventType: 'Wedding', serviceStyle: 'Kada Khana (Buffet)', gathering: '', waiterDetails: {}, totalAmount: '', advanceAmount: '', notes: '' });
 } catch (error) {
 console.error("Error deleting document: ", error);
 alert("Error deleting booking!");
 }
 };

 const handleDownloadPDF = () => {
   window.print();
 };

 const handleShareWhatsApp = () => {
   if (!selectedBooking) return;
   
   const totalAmount = selectedBooking.totalAmount || 0;
   const advance = selectedBooking.advanceAmount || 0;
   const pending = totalAmount - advance;
   
   let text = `*Booking Details: ${selectedBooking.partyName}*\n\n`;
   if (selectedBooking.bookingId) text += `*ID:* ${selectedBooking.bookingId}\n`;
   text += `*Date:* ${format(selectedBooking.date instanceof Date ? selectedBooking.date : new Date(selectedBooking.date), 'dd MMMM yyyy')}\n`;
   text += `*Status:* ${selectedBooking.status}\n`;
   text += `*Event Type:* ${selectedBooking.eventType} (${selectedBooking.serviceStyle})\n`;
   text += `*Location:* ${selectedBooking.location}\n`;
   text += `*Total Waiters:* ${selectedBooking.waiters}\n\n`;
   
   text += `*Financials*\n`;
   text += `Total Deal: ₹${totalAmount}\n`;
   text += `Advance: ₹${advance}\n`;
   text += `Pending: ₹${pending}\n\n`;
   
   text += `Thank you for booking with JRK Waiter Supplier!`;
   
   const encodedText = encodeURIComponent(text);
   window.open(`https://wa.me/?text=${encodedText}`, '_blank');
 };

 const renderHeader = () => {
 return (
 <header className="flex justify-between items-center mb-6">
 <div className="flex items-center gap-4">
 <button aria-label="Previous Month" onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500">
 <ChevronLeft className="w-5 h-5 text-gray-600 " />
 </button>
 <h2 aria-live="polite" className="text-2xl font-bold text-gray-800 w-48 text-center">
 {format(currentDate, 'MMMM yyyy')}
 </h2>
 <button aria-label="Next Month" onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500">
 <ChevronRight className="w-5 h-5 text-gray-600 " />
 </button>
 </div>
 <button 
 aria-label="Create New Booking"
 onClick={() => {
 setNewBooking({ ...newBooking, date: format(new Date(), 'yyyy-MM-dd') });
 setCurrentView('newBooking');
 }}
 className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Plus className="w-5 h-5" aria-hidden="true" />
 <span>New Booking</span>
 </button>
 </header>
 );
 };

 const renderDays = () => {
 const days = [];
 const dateFormat = "EEEE";
 let startDate = startOfWeek(currentDate);

 for (let i = 0; i < 7; i++) {
 days.push(
 <div className="text-center font-semibold text-sm text-gray-500 py-3 uppercase tracking-wider" key={i}>
 {format(addDays(startDate, i), dateFormat).substring(0, 3)}
 </div>
 );
 }
 return <div className="grid grid-cols-7 border-b border-gray-100 ">{days}</div>;
 };

 const renderCells = () => {
 const monthStart = startOfMonth(currentDate);
 const monthEnd = endOfMonth(monthStart);
 const startDate = startOfWeek(monthStart);
 const endDate = endOfWeek(monthEnd);

 const dateFormat = "d";
 const rows = [];
 let days = [];
 let day = startDate;
 let formattedDate = "";

 while (day <= endDate) {
 for (let i = 0; i < 7; i++) {
 formattedDate = format(day, dateFormat);
 const cloneDay = day;
 
 const dayBookings = bookings.filter(b => isSameDay(b.date, cloneDay));

 days.push(
 <div
 className={cn(
 "min-h-[120px] p-2 border-r border-b border-gray-100 transition-colors cursor-pointer group hover:bg-blue-50/50 relative",
 !isSameMonth(day, monthStart) ? "bg-gray-50/50 text-gray-400" : "bg-white ",
 isSameDay(day, new Date()) ? "bg-blue-50/30 " : ""
 )}
 key={day}
 onClick={() => handleDateClick(cloneDay)}
 >
 <div className="flex justify-between items-start">
 <span className={cn(
 "w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium",
 isSameDay(day, new Date()) ? "bg-blue-600 text-white shadow-md" : "text-gray-700 group-hover:text-blue-600"
 )}>
 {formattedDate}
 </span>
 {dayBookings.length > 0 && (
 <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
 {dayBookings.reduce((sum, b) => sum + b.waiters, 0)} Waiters
 </span>
 )}
 </div>
 
 <div className="mt-2 space-y-1.5 overflow-y-auto max-h-[70px] no-scrollbar">
 {dayBookings.map(booking => (
 <div 
 key={booking.id} 
 className={cn(
 "text-xs p-1.5 rounded-md truncate border",
 booking.status === 'Confirmed' 
 ? "bg-green-50 border-green-200 text-green-700 " 
 : "bg-yellow-50 border-yellow-200 text-yellow-700 "
 )}
 title={`${booking.partyName} - ${booking.waiters} Waiters`}
 onClick={(e) => {
 e.stopPropagation();
 setSelectedBooking(booking);
 setCurrentView('viewBooking');
 }}
 >
 <div className="font-semibold truncate">{booking.partyName}</div>
 <div className="text-[10px] text-gray-500 truncate mb-0.5">
 {booking.eventType || 'Event'} • {booking.serviceStyle === 'Baitha Khana (Table Setting)' ? 'Baitha Khana' : 'Buffet'}
 </div>
 <div className="flex items-center gap-1 opacity-80">
 <Users className="w-3 h-3" /> {booking.waiters}
 </div>
 {booking.waiterDetails && Object.keys(booking.waiterDetails).length > 0 && (
 <div className="text-[10px] opacity-70 truncate mt-0.5">
 {Object.entries(booking.waiterDetails).map(([type, details]) => `${type}(${details.count})`).join(', ')}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
 day = addDays(day, 1);
 }
 rows.push(
 <div className="grid grid-cols-7" key={day}>
 {days}
 </div>
 );
 days = [];
 }
 return <div className="bg-white rounded-b-2xl border-l border-t border-gray-100 overflow-hidden">{rows}</div>;
 };

 const totalWaitersThisMonth = bookings
 .filter(b => isSameMonth(b.date, currentDate))
 .reduce((sum, b) => sum + b.waiters, 0);

 const upcomingBookings = bookings.filter(b => b.date >= new Date()).length;

 return (
 <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex">
 {/* Sidebar */}
 <aside className="w-72 shrink-0 bg-white border-r border-gray-200 hidden md:flex flex-col">
 <div className="h-20 flex items-center px-5 border-b border-gray-200 ">
 <div className="flex items-center gap-3 text-blue-600 overflow-hidden w-full">
 <img src="/jrkwaiters.png" alt="JRK Logo" className="w-12 h-12 shrink-0 object-contain rounded-full border border-gray-200 shadow-sm" onError={(e) => { e.target.onerror = null; e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
 <div style={{display: 'none'}}>
 <Utensils className="w-6 h-6 shrink-0" />
 </div>
 <div className="flex flex-col overflow-hidden w-full">
 <span className="text-[17px] font-black tracking-tight truncate text-gray-900 leading-none">J R K Waiters Supplier</span>
 <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-1.5 truncate">Waiter Supplier & Services</span>
 </div>
 </div>
 </div>
 <nav className="flex-1 px-4 py-6 space-y-2">
 <button onClick={() => setCurrentView('calendar')} className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium transition", currentView === 'calendar' ? "bg-blue-50 text-blue-700 " : "text-gray-600 hover:bg-gray-100 ")}>
 <LayoutDashboard className="w-5 h-5" /> Dashboard
 </button>
 <button onClick={() => setCurrentView('newBooking')} className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium transition", currentView === 'newBooking' ? "bg-blue-50 text-blue-700 " : "text-gray-600 hover:bg-gray-100 ")}>
 <Plus className="w-5 h-5" /> Add Booking
 </button>
 <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition">
 <Users className="w-5 h-5" /> Waiter Staff
 </button>
 </nav>
 <div className="p-4 border-t border-gray-200 ">
 <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition">
 <Settings className="w-5 h-5" /> Settings
 </a>
 </div>
 </aside>

 {/* Main Content */}
 <main className="flex-1 flex flex-col h-screen overflow-hidden">
 {/* Header */}
 <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
 <div className="relative w-96">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input 
 type="text" 
 placeholder="Search parties, locations..." 
 className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 "
 />
 </div>
 <div className="flex items-center gap-4">
 <button className="p-2 relative text-gray-600 hover:bg-gray-100 rounded-full transition">
 <Bell className="w-5 h-5" />
 <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border border-white "></span>
 </button>
 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer">
 JD
 </div>
 </div>
 </header>

 {/* Main Area */}
 <div className="flex-1 overflow-auto p-8 no-scrollbar">
 {currentView === 'calendar' ? (
 <>
 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
 <CalendarIcon className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-gray-500 ">Total Bookings (Month)</p>
 <h3 className="text-2xl font-bold">{bookings.filter(b => isSameMonth(b.date, currentDate)).length}</h3>
 </div>
 </div>
 
 <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
 <Users className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-gray-500 ">Waiters Deployed (Month)</p>
 <h3 className="text-2xl font-bold">{totalWaitersThisMonth}</h3>
 </div>
 </div>

 <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-green-100 text-green-600 rounded-xl">
 <Clock className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-gray-500 ">Upcoming Events</p>
 <h3 className="text-2xl font-bold">{upcomingBookings}</h3>
 </div>
 </div>
 </div>

 {/* Calendar Section */}
 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
 {renderHeader()}
 <div className="border border-gray-100 rounded-2xl bg-gray-50 ">
 {renderDays()}
 {renderCells()}
 </div>
 </div>
 </>
 ) : currentView === 'newBooking' ? (
 <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
 <div className="px-8 py-6 border-b border-gray-100 ">
 <h2 className="text-2xl font-bold text-gray-900 ">{newBooking.id ? 'Edit Booking details' : 'Create New Booking'}</h2>
 <p className="text-gray-500 text-sm mt-1">Fill in the details below to add a new event to the calendar.</p>
 </div>
 
 <form onSubmit={handleAddBooking} className="p-8 space-y-8 bg-gray-50/30 ">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Party / Client Name *</label>
 <input 
 required
 type="text" 
 value={newBooking.partyName}
 onChange={e => setNewBooking({...newBooking, partyName: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 placeholder="e.g. Sharma Wedding"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
 <input 
 required
 type="date" 
 value={newBooking.date}
 onChange={e => setNewBooking({...newBooking, date: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
 <select 
 required
 value={newBooking.eventType}
 onChange={e => setNewBooking({...newBooking, eventType: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
 >
 <option value="Wedding">Wedding</option>
 <option value="Reception">Reception</option>
 <option value="Engagement">Engagement (Roka)</option>
 <option value="Haldi / Mehendi">Haldi / Mehendi</option>
 <option value="Sangeet">Sangeet</option>
 <option value="Birthday Party">Birthday Party</option>
 <option value="Anniversary">Anniversary</option>
 <option value="House Warming">House Warming (Griha Pravesh)</option>
 <option value="Naming Ceremony">Naming Ceremony (Namkaran)</option>
 <option value="Retirement Party">Retirement Party</option>
 <option value="Festival Celebration">Festival Celebration</option>
 <option value="Corporate Event">Corporate Event</option>
 <option value="Seminar / Conference">Seminar / Conference</option>
 <option value="Kitty Party">Kitty Party</option>
 <option value="Family Function">Family Function</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Service Style *</label>
 <select 
 required
 value={newBooking.serviceStyle}
 onChange={e => setNewBooking({...newBooking, serviceStyle: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
 >
 <option value="Kada Khana (Buffet)">Kada Khana (Buffet)</option>
 <option value="Baitha Khana (Table Setting)">Baitha Khana (Table Setting)</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Approx Gathering (Guests)</label>
 <input 
 type="number" 
 value={newBooking.gathering}
 onChange={e => setNewBooking({...newBooking, gathering: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 placeholder="e.g. 500"
 />
 </div>
 </div>

 <div className="space-y-4">
 <label className="block text-sm font-medium text-gray-700 ">Waiter Types & Requirements</label>
 <div className="flex flex-col gap-3">
 {['General Waiter', 'Masalchi Waiter', 'Captain', 'Helper'].map(type => {
 const isSelected = !!newBooking.waiterDetails?.[type];
 return (
 <div key={type} className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/50 transition">
 <label className="flex items-center gap-3 cursor-pointer">
 <input 
 type="checkbox" 
 checked={isSelected}
 onChange={(e) => {
 const currentDetails = { ...(newBooking.waiterDetails || {}) };
 if (e.target.checked) {
 currentDetails[type] = { count: 1, charge: '', shift: 'Ek hazri' };
 } else {
 delete currentDetails[type];
 }
 setNewBooking({...newBooking, waiterDetails: currentDetails});
 }}
 className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
 />
 <span className="text-sm font-semibold text-gray-800 ">{type}</span>
 </label>
 
 {isSelected && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 pl-0 md:pl-7">
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1.5">Kitne Waiter?</label>
 <input 
 type="number" 
 min="1"
 required
 value={newBooking.waiterDetails[type].count}
 onChange={(e) => {
 setNewBooking({
 ...newBooking, 
 waiterDetails: {
 ...newBooking.waiterDetails, 
 [type]: { ...newBooking.waiterDetails[type], count: e.target.value }
 }
 });
 }}
 className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1.5">Charge (Per Waiter)</label>
 <input 
 type="number" 
 min="0"
 required
 placeholder="₹"
 value={newBooking.waiterDetails[type].charge}
 onChange={(e) => {
 setNewBooking({
 ...newBooking, 
 waiterDetails: {
 ...newBooking.waiterDetails, 
 [type]: { ...newBooking.waiterDetails[type], charge: e.target.value }
 }
 });
 }}
 className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1.5">Shift Type</label>
 <select 
 value={newBooking.waiterDetails[type].shift}
 onChange={(e) => {
 setNewBooking({
 ...newBooking, 
 waiterDetails: {
 ...newBooking.waiterDetails, 
 [type]: { ...newBooking.waiterDetails[type], shift: e.target.value }
 }
 });
 }}
 className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition cursor-pointer"
 >
 <option value="Ek hazri">Ek hazri</option>
 <option value="Ded hazri">1.5 Hazri (Ded)</option>
 <option value="Double hazri">2 Hazri (Double)</option>
 </select>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 mt-2">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Total Deal Amount (₹) <span className="text-xs text-blue-500 font-normal">(Auto Calculated)</span></label>
 <input 
 type="number" 
 value={newBooking.totalAmount}
 onChange={e => setNewBooking({...newBooking, totalAmount: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-blue-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-semibold"
 placeholder="e.g. 5000"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Advance Received (₹)</label>
 <input 
 type="number" 
 value={newBooking.advanceAmount}
 onChange={e => setNewBooking({...newBooking, advanceAmount: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 placeholder="e.g. 1000"
 />
 </div>
 </div>

 <div className="pt-2">
 <label className="block text-sm font-medium text-gray-700 mb-1">Special Notes / Demands</label>
 <textarea 
 value={newBooking.notes}
 onChange={e => setNewBooking({...newBooking, notes: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none h-24"
 placeholder="Any special requirement..."
 />
 </div>

 <div className="pt-4 border-t border-gray-100 mt-2">
 <label className="block text-sm font-medium text-gray-700 mb-1">Venue Location / Address</label>
 <textarea 
 value={newBooking.location}
 onChange={e => setNewBooking({...newBooking, location: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none h-20"
 placeholder="Full address of the event..."
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-2">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Primary Phone</label>
 <input 
 type="tel" 
 value={newBooking.phone}
 onChange={e => setNewBooking({...newBooking, phone: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 placeholder="Contact number"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
 <input 
 type="tel" 
 value={newBooking.altPhone}
 onChange={e => setNewBooking({...newBooking, altPhone: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
 placeholder="Optional number"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
 <select 
 value={newBooking.status}
 onChange={e => setNewBooking({...newBooking, status: e.target.value})}
 className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
 >
 <option value="Pending">Pending</option>
 <option value="Confirmed">Confirmed</option>
 </select>
 </div>
 </div>

 <div className="pt-6 border-t border-gray-100 flex flex-wrap md:flex-nowrap gap-4 shrink-0">
 <button 
 type="button"
 onClick={() => {
 setCurrentView('calendar');
 setNewBooking({ partyName: '', date: format(new Date(), 'yyyy-MM-dd'), status: 'Pending', phone: '', altPhone: '', location: '', eventType: 'Wedding', serviceStyle: 'Kada Khana (Buffet)', gathering: '', waiterDetails: {}, totalAmount: '', advanceAmount: '', notes: '' });
 }}
 className="w-full md:flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
 >
 Cancel
 </button>
 
 {newBooking.id && (
 <button 
 type="button"
 onClick={handleDeleteBooking}
 className="w-full md:flex-1 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
 >
 Delete Booking
 </button>
 )}

 <button 
 type="submit"
 className="w-full md:flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-200 transition-all active:scale-95"
 >
 {newBooking.id ? 'Update Booking' : 'Save Booking'}
 </button>
 </div>
 </form>
 </div>
 ) : currentView === 'viewBooking' && selectedBooking ? (
 <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
 {/* Header */}
 <div className="px-8 py-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50 ">
 <div>
 <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedBooking.partyName}</h2>
 <div className="flex flex-wrap items-center gap-3">
 <span className={cn(
 "text-xs font-bold px-3 py-1 rounded-full",
 selectedBooking.status === 'Confirmed' ? "bg-green-100 text-green-700 " : "bg-yellow-100 text-yellow-700 "
 )}>
 {selectedBooking.status}
 </span>
 <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
 <CalendarIcon className="w-4 h-4" />
 {format(selectedBooking.date instanceof Date ? selectedBooking.date : new Date(selectedBooking.date), 'dd MMMM yyyy, EEEE')}
 </span>
 </div>
 </div>
 <div className="flex gap-3">
 <button 
 onClick={() => setCurrentView('calendar')}
 className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
 >
 Back
 </button>
 <button 
 onClick={handleDownloadPDF}
 className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
 >
 <Download className="w-4 h-4" /> Save as PDF / Print
 </button>
 <button 
 onClick={handleShareWhatsApp}
 className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium shadow-md shadow-green-200 transition-all"
 >
 <MessageCircle className="w-4 h-4" /> Share
 </button>
 <button 
 onClick={() => setReceiptLang(receiptLang === 'en' ? 'hi' : 'en')}
 className="px-4 py-2 rounded-xl border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium transition"
 >
 {receiptLang === 'en' ? 'हिंदी में देखें' : 'View in English'}
 </button>
 <button 
 onClick={() => {
 const bookingDate = selectedBooking.date instanceof Date ? format(selectedBooking.date, 'yyyy-MM-dd') : format(new Date(selectedBooking.date), 'yyyy-MM-dd');
 setNewBooking({
 ...selectedBooking,
 date: bookingDate,
 });
 setCurrentView('newBooking');
 }}
 className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-200 transition-all"
 >
 Edit Details
 </button>
 </div>
 </div>

 {/* Receipt Content (This will be printed/PDF'd) */}
 <div id="receipt-content" className="bg-white mx-auto max-w-4xl shadow-2xl my-8 relative overflow-hidden">
 {/* Decorative top border */}
 <div className="h-4 w-full bg-gradient-to-r from-[#1A1A1A] via-[#D4AF37] to-[#1A1A1A]"></div>
 
 <div className="p-12">
 {/* Header */}
 <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
 <div className="flex items-center gap-4">
 <img src="/jrkwaiters.png" alt="JRK Logo" className="w-24 h-24 object-contain rounded-full border border-gray-200 shadow-sm" onError={(e) => { e.target.onerror = null; e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
 <div style={{display: 'none'}} className="w-14 h-14 bg-blue-600 rounded-xl items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-200">
 JW
 </div>
 <div>
 <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">J R K WAITERS SUPPLIER</h1>
 <p className="text-xs text-gray-500 font-bold tracking-[0.2em] uppercase mt-1.5">{receiptLang === 'en' ? 'Waiter Supplier & Services' : 'वेटर सप्लायर और सेवाएं'}</p>
 </div>
 </div>
 <div className="text-right">
 <h2 className="text-3xl font-black text-gray-200 uppercase tracking-widest mb-2">{receiptLang === 'en' ? 'BOOKING RECEIPT' : 'बुकिंग रसीद'}</h2>
 <p className="text-sm font-bold text-gray-800 tracking-wider">ID: <span className="font-bold text-blue-600">{selectedBooking.bookingId || `JRK---`}</span></p>
 <p className="text-sm font-bold text-gray-800 mt-1">{receiptLang === 'en' ? 'Event Date' : 'कार्यक्रम दिनांक'}: <span className="inline-block px-2.5 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#B8860B] font-black rounded-md shadow-sm ml-1">{format(selectedBooking.date instanceof Date ? selectedBooking.date : new Date(selectedBooking.date), 'dd MMMM yyyy')}</span></p>
 </div>
 </div>

 {/* Bill To & Event Details */}
 <div className="mb-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-300">
 <div className="flex flex-col md:flex-row justify-between gap-8 mb-4">
 <div className="flex-1">
 <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{receiptLang === 'en' ? 'Billed To:' : 'बिल प्राप्तकर्ता:'}</p>
 <h3 className="text-xl font-bold text-gray-900">{selectedBooking.partyName}</h3>
 <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><span className="font-medium text-gray-800">M:</span> {selectedBooking.phone}</p>
 {selectedBooking.altPhone && <p className="text-sm text-gray-600 flex items-center gap-1"><span className="font-medium text-gray-800">A:</span> {selectedBooking.altPhone}</p>}
 </div>
 <div className="text-left md:text-right flex-1">
 <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{receiptLang === 'en' ? 'Event Details:' : 'कार्यक्रम विवरण:'}</p>
 <p className="text-base text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-lg inline-block">{selectedBooking.eventType}</p>
 <p className="text-sm text-gray-800 font-medium mt-3">{receiptLang === 'en' ? 'Style' : 'शैली'}: <span className="text-gray-600">{selectedBooking.serviceStyle}</span></p>
 <p className="text-sm text-gray-800 font-medium mt-1">{receiptLang === 'en' ? 'Gathering' : 'मेहमान'}: <span className="text-gray-600">{selectedBooking.gathering ? `${selectedBooking.gathering} ${receiptLang === 'en' ? 'Guests' : 'लोग'}` : 'N/A'}</span></p>
 </div>
 </div>
 <div className="p-3 bg-white rounded-lg border border-gray-300 block w-full shadow-sm">
 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{receiptLang === 'en' ? 'Event Location' : 'कार्यक्रम स्थल'}</p>
 <p className="text-sm text-gray-800 font-semibold flex items-start gap-2 leading-relaxed">
 <svg className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
 <span>{selectedBooking.location || (receiptLang === 'en' ? 'Location not provided' : 'स्थान नहीं दिया गया')}</span>
 </p>
 </div>
 </div>

 {/* Table */}
 <div className="mb-6 rounded-2xl border border-gray-300 overflow-hidden">
 <table className="w-full text-left border-collapse">
 <thead className="bg-gray-50 border-b border-gray-300">
 <tr>
 <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">{receiptLang === 'en' ? 'Staff / Service' : 'स्टाफ / सेवा'}</th>
 <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{receiptLang === 'en' ? 'Shift' : 'शिफ्ट'}</th>
 <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{receiptLang === 'en' ? 'Qty' : 'मात्रा'}</th>
 <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{receiptLang === 'en' ? 'Charges (per Waiter)' : 'शुल्क (प्रति वेटर)'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-300">
 {(!selectedBooking.waiterDetails || Object.keys(selectedBooking.waiterDetails).length === 0) ? (
 <tr>
 <td colSpan="4" className="py-8 px-6 text-center text-gray-400 italic">{receiptLang === 'en' ? 'No staff requirements added.' : 'कोई स्टाफ आवश्यकता नहीं जोड़ी गई है।'}</td>
 </tr>
 ) : (
 Object.entries(selectedBooking.waiterDetails).map(([type, details]) => (
 <tr key={type} className="hover:bg-gray-50/50 transition">
 <td className="py-4 px-6 text-sm font-bold text-gray-900">{type}</td>
 <td className="py-4 px-6 text-sm text-gray-600 text-center bg-gray-50/50 font-medium">{details.shift}</td>
 <td className="py-4 px-6 text-sm text-gray-900 font-bold text-center">{details.count}</td>
 <td className="py-4 px-6 text-sm text-gray-600 text-right font-medium">₹{details.charge}</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* Totals & Notes Row */}
 <div className="flex flex-col gap-6 mb-6">
 {/* Notes */}
 {selectedBooking.notes && (
 <div className="w-full">
 <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{receiptLang === 'en' ? 'Special Instructions:' : 'विशेष निर्देश:'}</p>
 <div className="text-sm text-gray-700 bg-amber-50/50 border border-amber-100 p-4 rounded-xl leading-relaxed">
 {selectedBooking.notes}
 </div>
 </div>
 )}

 {/* Totals */}
 <div className="w-full">
 <div className="bg-gray-50 rounded-2xl p-6 border border-gray-300">
 <div className="flex justify-between py-2">
 <span className="text-sm text-gray-600 font-medium">{receiptLang === 'en' ? 'Total Deal Amount' : 'कुल डील राशि'}</span>
 <span className="text-sm text-gray-900 font-bold">₹{selectedBooking.totalAmount || '0'}</span>
 </div>
 <div className="flex justify-between py-2">
 <span className="text-sm text-gray-600 font-medium">{receiptLang === 'en' ? 'Advance Received' : 'अग्रिम प्राप्त राशि'}</span>
 <span className="text-sm text-green-600 font-bold">₹{selectedBooking.advanceAmount || '0'}</span>
 </div>
 <div className="flex justify-between py-4 border-t border-gray-300 mt-2">
 <span className="text-lg text-gray-900 font-black uppercase tracking-tight">{receiptLang === 'en' ? 'Balance Due' : 'बकाया राशि'}</span>
 <span className="text-2xl text-gray-900 font-black">₹{Number(selectedBooking.totalAmount || 0) - Number(selectedBooking.advanceAmount || 0)}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="text-center pt-8 border-t border-gray-300">
 <p className="text-xl font-black text-gray-900 mb-2">{receiptLang === 'en' ? 'Thank you for your business!' : 'हमारे साथ व्यापार करने के लिए धन्यवाद!'}</p>
 <p className="text-sm text-gray-500 font-medium">JRK Waiter Supplier & Services • Support: +91 6378586370</p>
 </div>
 </div>
 </div>
 </div>
 ) : null}
 </div>
 </main>
 </div>
 );
}

export default App;
