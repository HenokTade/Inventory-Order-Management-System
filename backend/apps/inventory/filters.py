import django_filters
from django.db.models import F

from apps.inventory.models import Product, StockLog


class ProductFilter(django_filters.FilterSet):
    low_stock = django_filters.BooleanFilter(method="filter_low_stock")
    q = django_filters.CharFilter(method="filter_q")

    class Meta:
        model = Product
        fields = ["organization", "is_active", "aisle", "rack", "shelf", "bin"]

    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(stock_qty__lt=F("safety_stock"))
        return queryset.exclude(stock_qty__lt=F("safety_stock"))

    def filter_q(self, queryset, name, value):
        from django.db.models import Q

        return queryset.filter(
            Q(sku_code__icontains=value) | Q(name__icontains=value) | Q(barcode__icontains=value)
        )


class StockLogFilter(django_filters.FilterSet):
    product = django_filters.NumberFilter()
    reason = django_filters.ChoiceFilter(choices=StockLog.Reason.choices)
    created_at_gte = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_at_lte = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = StockLog
        fields = ["product", "reason"]
